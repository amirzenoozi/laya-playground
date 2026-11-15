// Reads the server's Server-Sent Events as they arrive; both streams (Laya's answers, chat replies) use it.

export interface RawEvent {
  name: string;
  data: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBlock(block: string): RawEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  try {
    return { name, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

// Keeps any unfinished block for the next chunk; a block ends with a blank line.
export function splitEvents(buffer: string): { events: RawEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = blocks.map(parseBlock).filter((event): event is RawEvent => event !== null);
  return { events, rest };
}

// FastAPI answers a refused request with {"detail": "..."} or, for invalid fields, {"detail": [{"msg": ...}]}.
export async function refusal(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const detail = isRecord(body) ? body.detail : undefined;
    if (typeof detail === "string") return detail;
    const first: unknown = Array.isArray(detail) ? detail[0] : undefined;
    if (isRecord(first) && typeof first.msg === "string") return first.msg;
  } catch {
    // Not JSON: fall through to the status
  }
  return `The server answered ${response.status}`;
}

// Posts `body` and hands each event to `onEvent`; a refused request becomes `onRefused` with its reason.
export async function postEvents(
  url: string,
  body: unknown,
  handlers: { onEvent: (event: RawEvent) => void; onRefused: (message: string) => void },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    handlers.onRefused(await refusal(response));
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = splitEvents(buffer + value);
    buffer = rest;
    events.forEach(handlers.onEvent);
  }
}
