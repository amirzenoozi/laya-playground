import { describe, expect, it } from "vitest";
import { chatBody, shortModelName, toChatEvent } from "./chat";

describe("chatBody", () => {
  it("puts a written system prompt first, leaves out empty replies, and sends only the options set", () => {
    const body = chatBody({ model: "m", system: " Be brief. ", temperature: 0, maxTokens: null }, [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "" },
      { role: "user", content: "Again" },
    ]);

    expect(body).toEqual({
      model: "m",
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi" },
        { role: "user", content: "Again" },
      ],
      options: { temperature: 0 },
    });
  });
});

describe("toChatEvent", () => {
  it("reads tokens, done and errors, and skips anything else", () => {
    expect(toChatEvent("token", { text: "Hi" })).toEqual({ type: "token", text: "Hi" });
    expect(toChatEvent("done", { first_token_ms: null, total_ms: 10, tokens: 2 })).toEqual({
      type: "done",
      stats: { firstTokenMs: null, totalMs: 10, tokens: 2 },
    });
    expect(toChatEvent("error", { message: "boom" })).toEqual({ type: "error", message: "boom", traceId: undefined });
    expect(toChatEvent("token", { text: 5 })).toBeNull();
    expect(toChatEvent("other", {})).toBeNull();
  });
});

it("shortens a Hugging Face model name to its last part", () => {
  expect(shortModelName("hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M")).toBe("gemma-3-4b-it-abliterated-GGUF:Q4_K_M");
  expect(shortModelName("llama3.2:3b")).toBe("llama3.2:3b");
});
