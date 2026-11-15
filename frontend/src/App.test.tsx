import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// A response body the test feeds one event at a time, to see the UI between them.
function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  const encoder = new TextEncoder();
  return {
    body,
    send: (name: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => controller.close(),
  };
}

const status = { model_found: true, loaded: false, keep_alive: 300 };

function mockServer(askResponse: () => Response) {
  const fetchMock = vi.fn((url: string) => Promise.resolve(url === "/api/status" ? Response.json(status) : askResponse()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function writeYesNoQuestion(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Text to judge/), "The parcel never arrived.");
  await user.type(screen.getByRole("textbox", { name: "Question 1" }), "Is the writer unhappy?");
}

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("shows each answer as it streams in, with the others still waiting", async () => {
    const stream = controlledStream();
    const fetchMock = mockServer(() => new Response(stream.body, { headers: { "Content-Type": "text/event-stream" } }));
    const user = userEvent.setup();
    render(<App />);
    await writeYesNoQuestion(user);
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.type(screen.getByRole("textbox", { name: "Question 2" }), "How angry?");
    await user.click(within(screen.getByRole("region", { name: "Question 2" })).getByRole("radio", { name: "Score" }));
    await user.type(screen.getByRole("textbox", { name: "Levels, lowest first" }), "calm{Enter}furious{Enter}");

    await user.click(screen.getByRole("button", { name: "Ask" }));

    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/ask") as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).questions[1]).toEqual({ type: "score", instruction: "How angry?", levels: ["calm", "furious"] });
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: "Waiting for the answer" })).toHaveLength(2);

    stream.send("status", { state: "loading" });
    expect(await screen.findByText(/Loading Laya/)).toBeInTheDocument();

    stream.send("status", { state: "ready", load_ms: 1400 });
    stream.send("answer", {
      index: 0,
      winner: "yes",
      probabilities: [{ label: "yes", probability: 0.76 }, { label: "no", probability: 0.24 }],
      confidence: 0.76,
      score: null,
      ms: 95,
    });
    const first = await screen.findByRole("article", { name: "Answer 1" });
    expect(within(first).getByText("76%")).toBeInTheDocument();
    expect(screen.queryByText(/Loading Laya/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Answer 2" })).getByRole("status", { name: "Waiting for the answer" })).toBeInTheDocument();

    stream.send("answer", {
      index: 1,
      winner: "furious",
      probabilities: [{ label: "calm", probability: 0.3 }, { label: "furious", probability: 0.7 }],
      confidence: 0.4,
      score: 0.7,
      ms: 88,
    });
    stream.send("done", { total_ms: 1600 });
    stream.close();

    expect(await screen.findByText("Answered in 1600 ms, of which 1400 ms loading Laya.")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Answer 2" })).getByText(/Expected level 0.70 on a scale of 0 to 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
  });

  it("shows a server error with its trace id, and Retry asks again", async () => {
    let calls = 0;
    mockServer(() => {
      calls += 1;
      const stream = controlledStream();
      stream.send("error", { message: "Laya did not answer within 30s", trace_id: "abc123" });
      stream.close();
      return new Response(stream.body);
    });
    const user = userEvent.setup();
    render(<App />);
    await writeYesNoQuestion(user);

    await user.click(screen.getByRole("button", { name: "Ask" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Laya did not answer within 30s");
    expect(alert).toHaveTextContent("Trace id abc123");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it("shows a refused request's reason", async () => {
    mockServer(() => Response.json({ detail: "Laya's files are not in /nowhere; set LAYA_MODEL_PATH in .env." }, { status: 503 }));
    const user = userEvent.setup();
    render(<App />);
    await writeYesNoQuestion(user);

    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("set LAYA_MODEL_PATH");
  });

  it("will not ask until the questions are complete, and says what is missing", async () => {
    const fetchMock = mockServer(() => Response.json({}));
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(screen.getByText("Write the text to judge")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Text to judge/), "Hello");
    expect(screen.getByText("Question 1: Write the question")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/ask")).toBe(false);
  });

  it("adds a template's question with its options", async () => {
    mockServer(() => Response.json({}));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Topic" }));

    const added = screen.getByRole("region", { name: "Question 2" });
    expect(within(added).getByRole("textbox", { name: "Question 2" })).toHaveValue("What is the text mainly about?");
    expect(within(added).getByRole("button", { name: "Remove delivery" })).toBeInTheDocument();
  });

  it("remembers the text and questions after a reload", async () => {
    mockServer(() => Response.json({}));
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await writeYesNoQuestion(user);
    unmount();

    render(<App />);

    expect(screen.getByLabelText(/Text to judge/)).toHaveValue("The parcel never arrived.");
    expect(screen.getByRole("textbox", { name: "Question 1" })).toHaveValue("Is the writer unhappy?");
  });
});
