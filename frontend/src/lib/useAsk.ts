import { useCallback, useEffect, useRef, useState } from "react";
import type { AskBody } from "./questions";
import { ask, type Answer, type AskEvent } from "./laya";

export type Phase = "idle" | "running" | "done" | "failed" | "stopped";

export interface Run {
  phase: Phase;
  // The questions as they were asked, so editing them later does not relabel the answers
  asked: AskBody | null;
  loading: boolean;
  loadMs: number | null;
  answers: (Answer | undefined)[];
  totalMs: number | null;
  error: { message: string; traceId?: string } | null;
}

const IDLE: Run = { phase: "idle", asked: null, loading: false, loadMs: null, answers: [], totalMs: null, error: null };

export function applyEvent(run: Run, event: AskEvent): Run {
  switch (event.type) {
    case "loading":
      return { ...run, loading: true };
    case "ready":
      return { ...run, loading: false, loadMs: event.loadMs };
    case "answer": {
      const answers = [...run.answers];
      answers[event.answer.index] = event.answer;
      return { ...run, answers };
    }
    case "done":
      return { ...run, phase: "done", totalMs: event.totalMs };
    case "error":
      return { ...run, phase: "failed", loading: false, error: { message: event.message, traceId: event.traceId } };
  }
}

function failed(run: Run, message: string): Run {
  return { ...run, phase: "failed", loading: false, error: { message } };
}

function stopped(run: Run): Run {
  return run.phase === "running" ? { ...run, phase: "stopped", loading: false } : run;
}

function offline(run: Run): Run {
  return failed(run, "Could not reach the server; is it running?");
}

// A stream that closes without "done" or "error" means the server stopped part way.
function settled(run: Run): Run {
  return run.phase === "running" ? failed(run, "The server stopped before answering every question") : run;
}

export function useAsk(): { run: Run; start: (body: AskBody) => void; stop: () => void } {
  const [run, setRun] = useState<Run>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  const start = useCallback((body: AskBody) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setRun({ ...IDLE, phase: "running", asked: body });
    // A newer run replaces this one; nothing this one hears afterwards may touch it
    const isLatest = () => controller.current === current;
    const onEvent = (event: AskEvent) => {
      if (isLatest() && !current.signal.aborted) setRun((previous) => applyEvent(previous, event));
    };
    ask(body, onEvent, current.signal)
      .then(() => {
        if (isLatest() && !current.signal.aborted) setRun(settled);
      })
      .catch(() => {
        if (isLatest()) setRun(current.signal.aborted ? stopped : offline);
      });
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { run, start, stop };
}
