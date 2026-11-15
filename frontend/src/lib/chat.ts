// The Chat side: Ollama's models, and a reply read piece by piece as it arrives.

import { errorEvent } from "./laya";
import { isRecord, postEvents, refusal } from "./sse";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatSettings {
  model: string;
  system: string;
  // null leaves the model's own default
  temperature: number | null;
  maxTokens: number | null;
}

export interface ChatBody {
  model: string;
  messages: ChatMessage[];
  options: { temperature?: number; max_tokens?: number };
}

export interface ReplyStats {
  firstTokenMs: number | null;
  totalMs: number;
  tokens: number | null;
}

export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "done"; stats: ReplyStats }
  | { type: "error"; message: string; traceId?: string };

export interface ModelInfo {
  name: string;
  size: number;
  parameters: string;
}

const numberOrNull = (value: unknown): number | null => (typeof value === "number" ? value : null);

export function toChatEvent(name: string, data: unknown): ChatEvent | null {
  if (!isRecord(data)) return null;
  if (name === "token") return typeof data.text === "string" ? { type: "token", text: data.text } : null;
  if (name === "error") return errorEvent(data);
  if (name !== "done") return null;
  return { type: "done", stats: { firstTokenMs: numberOrNull(data.first_token_ms), totalMs: Number(data.total_ms), tokens: numberOrNull(data.tokens) } };
}

// The system prompt goes first when written; empty messages (a reply stopped before its first word) are left out.
export function chatBody(settings: ChatSettings, history: ChatMessage[]): ChatBody {
  const system: ChatMessage[] = settings.system.trim() ? [{ role: "system", content: settings.system.trim() }] : [];
  const options: ChatBody["options"] = {};
  if (settings.temperature !== null) options.temperature = settings.temperature;
  if (settings.maxTokens !== null) options.max_tokens = settings.maxTokens;
  return { model: settings.model, messages: [...system, ...history.filter((message) => message.content.trim())], options };
}

export function streamChat(body: ChatBody, onEvent: (event: ChatEvent) => void, signal: AbortSignal): Promise<void> {
  return postEvents(
    "/api/chat",
    body,
    {
      onEvent: ({ name, data }) => {
        const event = toChatEvent(name, data);
        if (event) onEvent(event);
      },
      onRefused: (message) => onEvent({ type: "error", message }),
    },
    signal,
  );
}

export async function fetchModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const response = await fetch("/api/models", { signal });
  if (!response.ok) throw new Error(await refusal(response));
  const body: unknown = await response.json();
  return isRecord(body) && Array.isArray(body.models) ? (body.models as ModelInfo[]) : [];
}

// "hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M" reads better as "gemma-3-4b-it-abliterated-GGUF:Q4_K_M".
export function shortModelName(name: string): string {
  return name.split("/").pop() ?? name;
}
