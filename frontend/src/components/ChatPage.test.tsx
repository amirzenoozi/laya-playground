import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

const MODEL = "hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M";
const MODELS = { models: [{ name: MODEL, size: 2_490_000_000, parameters: "3.88B" }] };

function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  const encoder = new TextEncoder();
  return {
    // Like a real fetch, aborting the request breaks the body being read
    response: (init: RequestInit = {}) => {
      init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    },
    send: (name: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => controller.close(),
  };
}

type Chat = (init: RequestInit) => Response | Promise<Response>;

function mockServer(chat: Chat, models: () => Response = () => Response.json(MODELS)) {
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    if (url === "/api/models") return Promise.resolve(models());
    if (init.signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return Promise.resolve(chat(init));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBodies(fetchMock: ReturnType<typeof mockServer>) {
  return fetchMock.mock.calls.filter(([url]) => url === "/api/chat").map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

async function ready() {
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue(MODEL));
}

describe("ChatPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams the reply word by word, waiting before the first, then shows its stats", async () => {
    const stream = controlledStream();
    const fetchMock = mockServer(() => stream.response());
    const user = userEvent.setup();
    render(<ChatPage />);
    await ready();

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Name a quiet garden{Enter}");

    expect(sentBodies(fetchMock)).toEqual([{ model: MODEL, messages: [{ role: "user", content: "Name a quiet garden" }], options: {} }]);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    expect(screen.getByRole("status", { name: "Waiting for the first words" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();

    stream.send("token", { text: "Fern" });
    const reply = await screen.findByText("Fern");
    expect(screen.queryByRole("status", { name: "Waiting for the first words" })).not.toBeInTheDocument();

    stream.send("token", { text: " Hollow" });
    await waitFor(() => expect(reply).toHaveTextContent("Fern Hollow"));
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();

    stream.send("done", { first_token_ms: 420, total_ms: 1800, tokens: 3 });
    stream.close();

    expect(await screen.findByText("first words in 420 ms · 3 tokens · 1.8 s in total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("sends the history, the system prompt and options with the next message", async () => {
    const replies = ["Fern.", "Moss."];
    const fetchMock = mockServer(() => {
      const stream = controlledStream();
      stream.send("token", { text: replies.shift() });
      stream.send("done", { first_token_ms: 1, total_ms: 2, tokens: 1 });
      stream.close();
      return stream.response();
    });
    const user = userEvent.setup();
    render(<ChatPage />);
    await ready();
    await user.click(screen.getByText("System prompt and options"));
    await user.type(screen.getByRole("textbox", { name: "System prompt (optional)" }), "Be brief.");
    await user.type(screen.getByRole("spinbutton", { name: "Temperature (0 to 2)" }), "0.4");

    await user.type(screen.getByRole("textbox", { name: "Message" }), "One name{Enter}");
    await screen.findByText("Fern.");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Another{Enter}");
    await screen.findByText("Moss.");

    expect(sentBodies(fetchMock)[1]).toEqual({
      model: MODEL,
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "One name" },
        { role: "assistant", content: "Fern." },
        { role: "user", content: "Another" },
      ],
      options: { temperature: 0.4 },
    });
  });

  it("Stop keeps what was written so far, and Regenerate replaces it", async () => {
    const first = controlledStream();
    const fetchMock = mockServer((init) => first.response(init));
    const user = userEvent.setup();
    render(<ChatPage />);
    await ready();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Tell me a story{Enter}");
    first.send("token", { text: "Once upon" });
    await screen.findByText("Once upon");

    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByText("Once upon")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const second = controlledStream();
    fetchMock.mockImplementation((url: string, init: RequestInit = {}) => Promise.resolve(url === "/api/models" ? Response.json(MODELS) : second.response(init)));
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    second.send("token", { text: "A fox" });

    expect(await screen.findByText("A fox")).toBeInTheDocument();
    expect(screen.queryByText("Once upon")).not.toBeInTheDocument();
    expect(sentBodies(fetchMock).at(-1).messages).toEqual([{ role: "user", content: "Tell me a story" }]);
  });

  it("shows an error from the model with its trace id, and Retry asks again", async () => {
    let calls = 0;
    mockServer(() => {
      calls += 1;
      const stream = controlledStream();
      stream.send("error", { message: "Ollama: out of memory", trace_id: "t123" });
      stream.close();
      return stream.response();
    });
    const user = userEvent.setup();
    render(<ChatPage />);
    await ready();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Hi{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ollama: out of memory");
    expect(alert).toHaveTextContent("Trace id t123");
    expect(screen.queryByRole("status", { name: "Waiting for the first words" })).not.toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it("explains when Ollama is not running, and will not send", async () => {
    mockServer(
      () => Response.json({}),
      () => Response.json({ detail: "Ollama is not reachable at http://127.0.0.1:11434; is it running?" }, { status: 503 }),
    );
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(screen.getByRole("status", { name: "Loading models" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Ollama is not reachable");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Hi");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Shift Enter adds a line instead of sending, and New chat clears the conversation", async () => {
    mockServer(() => {
      const stream = controlledStream();
      stream.send("token", { text: "Hello!" });
      stream.send("done", { first_token_ms: 1, total_ms: 2, tokens: 1 });
      stream.close();
      return stream.response();
    });
    const user = userEvent.setup();
    render(<ChatPage />);
    await ready();
    const box = screen.getByRole("textbox", { name: "Message" });

    await user.type(box, "Line one{Shift>}{Enter}{/Shift}line two");
    expect(box).toHaveValue("Line one\nline two");
    await user.keyboard("{Enter}");
    await screen.findByText("Hello!");

    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("Hello!")).not.toBeInTheDocument();
  });

  it("remembers the conversation after a reload", async () => {
    mockServer(() => {
      const stream = controlledStream();
      stream.send("token", { text: "Fern." });
      stream.send("done", { first_token_ms: 1, total_ms: 2, tokens: 1 });
      stream.close();
      return stream.response();
    });
    const user = userEvent.setup();
    const { unmount } = render(<ChatPage />);
    await ready();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "One name{Enter}");
    await screen.findByText("Fern.");
    unmount();

    render(<ChatPage />);

    expect(screen.getByText("One name")).toBeInTheDocument();
    expect(screen.getByText("Fern.")).toBeInTheDocument();
  });
});
