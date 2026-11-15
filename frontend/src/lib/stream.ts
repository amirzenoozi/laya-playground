// Sends questions to the server and reads its Server-Sent Events as they arrive.

import type { AskBody } from "./questions";

export interface Probability {
  label: string;
  probability: number;
}

export interface Answer {
  index: number;
  winner: string;
  probabilities: Probability[];
  confidence: number;
  score: number | null;
  ms: number;
}

export type AskEvent =
  | { type: "loading" }
  | { type: "ready"; loadMs: number }
  | { type: "answer"; answer: Answer }
  | { type: "done"; totalMs: number }
  | { type: "error"; message: string; traceId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnswer(value: unknown): value is Answer {
  return isRecord(value) && typeof value.index === "number" && typeof value.winner === "string" && Array.isArray(value.probabilities);
}

function statusEvent(data: Record<string, unknown>): AskEvent | null {
  if (data.state === "loading") return { type: "loading" };
  return data.state === "ready" ? { type: "ready", loadMs: Number(data.load_ms) } : null;
}

function errorEvent(data: Record<string, unknown>): AskEvent {
  const traceId = typeof data.trace_id === "string" ? data.trace_id : undefined;
  return { type: "error", message: String(data.message ?? "Laya could not answer"), traceId };
}

export function toEvent(name: string, data: unknown): AskEvent | null {
  if (!isRecord(data)) return null;
  switch (name) {
    case "status":
      return statusEvent(data);
    case "answer":
      return isAnswer(data) ? { type: "answer", answer: data } : null;
    case "done":
      return { type: "done", totalMs: Number(data.total_ms) };
    case "error":
      return errorEvent(data);
    default:
      return null;
  }
}

function parseBlock(block: string): AskEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  try {
    return toEvent(name, JSON.parse(data.join("\n")));
  } catch {
    return null;
  }
}

// Keeps any unfinished block for the next chunk; a block ends with a blank line.
export function splitEvents(buffer: string): { events: AskEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = blocks.map(parseBlock).filter((event): event is AskEvent => event !== null);
  return { events, rest };
}

// FastAPI answers a refused request with {"detail": "..."} or, for invalid fields, {"detail": [{"msg": ...}]}.
async function refusal(response: Response): Promise<string> {
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

export async function ask(body: AskBody, onEvent: (event: AskEvent) => void, signal: AbortSignal): Promise<void> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    onEvent({ type: "error", message: await refusal(response) });
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = splitEvents(buffer + value);
    buffer = rest;
    events.forEach(onEvent);
  }
}

export interface Status {
  model_found: boolean;
  loaded: boolean;
  keep_alive: number;
}

export async function fetchStatus(signal?: AbortSignal): Promise<Status> {
  const response = await fetch("/api/status", { signal });
  if (!response.ok) throw new Error(`The server answered ${response.status}`);
  return (await response.json()) as Status;
}
