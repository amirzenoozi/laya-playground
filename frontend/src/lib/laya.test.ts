import { describe, expect, it } from "vitest";
import { splitEvents } from "./sse";
import { toEvent } from "./laya";

const answer = { index: 0, winner: "yes", probabilities: [{ label: "yes", probability: 0.8 }], confidence: 0.8, score: null, ms: 90 };

describe("splitEvents", () => {
  it("reads complete events and keeps an unfinished one for the next chunk", () => {
    const chunk = `event: status\ndata: {"state": "loading"}\n\nevent: answer\ndata: ${JSON.stringify(answer)}\n\nevent: do`;

    const { events, rest } = splitEvents(chunk);

    expect(events).toEqual([
      { name: "status", data: { state: "loading" } },
      { name: "answer", data: answer },
    ]);
    expect(rest).toBe("event: do");
    expect(splitEvents(rest + 'ne\ndata: {"total_ms": 120}\n\n').events).toEqual([{ name: "done", data: { total_ms: 120 } }]);
  });

  it("skips a block that is not JSON", () => {
    expect(splitEvents("event: done\ndata: not json\n\n").events).toEqual([]);
  });
});

describe("toEvent", () => {
  it("reads Laya's events and skips broken or unknown ones", () => {
    expect(toEvent("status", { state: "ready", load_ms: 1500 })).toEqual({ type: "ready", loadMs: 1500 });
    expect(toEvent("answer", answer)).toEqual({ type: "answer", answer });
    expect(toEvent("error", { message: "Laya did not answer", trace_id: "abc" })).toEqual({
      type: "error",
      message: "Laya did not answer",
      traceId: "abc",
    });
    expect(toEvent("answer", { index: "x" })).toBeNull();
    expect(toEvent("other", {})).toBeNull();
  });
});
