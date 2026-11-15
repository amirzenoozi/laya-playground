import { describe, expect, it } from "vitest";
import { splitEvents, toEvent } from "./stream";

const answer = { index: 0, winner: "yes", probabilities: [{ label: "yes", probability: 0.8 }], confidence: 0.8, score: null, ms: 90 };

describe("splitEvents", () => {
  it("reads complete events and keeps an unfinished one for the next chunk", () => {
    const chunk = `event: status\ndata: {"state": "loading"}\n\nevent: answer\ndata: ${JSON.stringify(answer)}\n\nevent: do`;

    const { events, rest } = splitEvents(chunk);

    expect(events).toEqual([{ type: "loading" }, { type: "answer", answer }]);
    expect(rest).toBe("event: do");
    expect(splitEvents(rest + 'ne\ndata: {"total_ms": 120}\n\n').events).toEqual([{ type: "done", totalMs: 120 }]);
  });

  it("skips broken and unknown events", () => {
    const { events } = splitEvents('event: answer\ndata: {"index": "x"}\n\nevent: other\ndata: {}\n\nevent: done\ndata: not json\n\n');

    expect(events).toEqual([]);
  });
});

describe("toEvent", () => {
  it("reads the ready and error events", () => {
    expect(toEvent("status", { state: "ready", load_ms: 1500 })).toEqual({ type: "ready", loadMs: 1500 });
    expect(toEvent("error", { message: "Laya did not answer", trace_id: "abc" })).toEqual({
      type: "error",
      message: "Laya did not answer",
      traceId: "abc",
    });
  });
});
