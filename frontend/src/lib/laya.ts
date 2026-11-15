// Laya's side: sends questions and reads the answers as they arrive.

import type { AskBody } from "./questions";
import { isRecord, postEvents } from "./sse";

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

function isAnswer(value: unknown): value is Answer {
  return isRecord(value) && typeof value.index === "number" && typeof value.winner === "string" && Array.isArray(value.probabilities);
}

function statusEvent(data: Record<string, unknown>): AskEvent | null {
  if (data.state === "loading") return { type: "loading" };
  return data.state === "ready" ? { type: "ready", loadMs: Number(data.load_ms) } : null;
}

export function errorEvent(data: Record<string, unknown>): { type: "error"; message: string; traceId?: string } {
  const traceId = typeof data.trace_id === "string" ? data.trace_id : undefined;
  return { type: "error", message: String(data.message ?? "Something went wrong"), traceId };
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

export function ask(body: AskBody, onEvent: (event: AskEvent) => void, signal: AbortSignal): Promise<void> {
  return postEvents(
    "/api/ask",
    body,
    {
      onEvent: ({ name, data }) => {
        const event = toEvent(name, data);
        if (event) onEvent(event);
      },
      onRefused: (message) => onEvent({ type: "error", message }),
    },
    signal,
  );
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
