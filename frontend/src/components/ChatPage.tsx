import { CircleAlert, MessageSquarePlus, RotateCcw, Send, Square } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fetchModels, type ChatMessage, type ChatSettings, type ReplyStats } from "../lib/chat";
import { loadChat, saveChat } from "../lib/storage";
import { useChat, type ChatState } from "../lib/useChat";
import { ChatSettingsPanel, type Models } from "./ChatSettingsPanel";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const DEFAULT_SETTINGS: ChatSettings = { model: "", system: "", temperature: null, maxTokens: null };

function useModels(settings: ChatSettings, setSettings: (settings: ChatSettings) => void) {
  const [models, setModels] = useState<Models>({ state: "pending" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModels({ state: "pending" });
    fetchModels(controller.signal)
      .then((found) => setModels({ state: "settled", models: found }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setModels({ state: "failed", message: error instanceof Error ? error.message : "Could not list the models" });
      });
    return () => controller.abort();
  }, [attempt]);

  // A remembered model Ollama no longer has falls back to its first one
  const firstModel = models.state === "settled" ? models.models[0]?.name : undefined;
  const known = models.state === "settled" && models.models.some((model) => model.name === settings.model);
  useEffect(() => {
    if (firstModel && !known) setSettings({ ...settings, model: firstModel });
  }, [firstModel, known, settings, setSettings]);

  return { models, retry: () => setAttempt((count) => count + 1), ready: known };
}

function Bubble({ message, writing }: { message: ChatMessage; writing: boolean }) {
  const mine = message.role === "user";
  const waiting = writing && !message.content;
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        aria-label={mine ? "You" : "Model"}
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
          mine ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm bg-white ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
        }`}
      >
        {waiting ? (
          <span role="status" aria-label="Waiting for the first words" className="inline-flex gap-1 py-1">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="size-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
        ) : (
          message.content
        )}
        {writing && message.content && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-stone-400" />}
      </div>
    </li>
  );
}

function Stats({ stats }: { stats: ReplyStats }) {
  const parts = [
    stats.firstTokenMs === null ? null : `first words in ${stats.firstTokenMs} ms`,
    stats.tokens === null ? null : `${stats.tokens} tokens`,
    `${(stats.totalMs / 1000).toFixed(1)} s in total`,
  ].filter(Boolean);
  return <p className="text-xs text-stone-500">{parts.join(" · ")}</p>;
}

function ReplyFooter({ state, onRegenerate }: { state: ChatState; onRegenerate: () => void }) {
  if (state.streaming || state.messages.length === 0) return null;
  if (state.error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <CircleAlert className="lucide shrink-0" />
        <span className="min-w-0 flex-1">
          {state.error.message}
          {state.error.traceId && <span className="block text-xs opacity-75">Trace id {state.error.traceId}</span>}
        </span>
        <button type="button" className={secondaryButtonClass} onClick={onRegenerate}>
          <RotateCcw className="lucide" /> Retry
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={secondaryButtonClass} onClick={onRegenerate}>
        <RotateCcw className="lucide" /> Regenerate
      </button>
      {state.stats && <Stats stats={state.stats} />}
    </div>
  );
}

export function ChatPage() {
  const [saved] = useState(loadChat);
  const [settings, setSettings] = useState<ChatSettings>(saved?.settings ?? DEFAULT_SETTINGS);
  const { models, retry, ready } = useModels(settings, setSettings);
  const { state, send, regenerate, stop, clear } = useChat(settings, saved?.messages ?? []);
  const [typed, setTyped] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.streaming) saveChat({ settings, messages: state.messages });
  }, [settings, state.messages, state.streaming]);
  useEffect(() => end.current?.scrollIntoView?.({ block: "end" }), [state.messages]);

  const canSend = ready && typed.trim() !== "" && !state.streaming;
  const submit = () => {
    if (!canSend) return;
    send(typed.trim());
    setTyped("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside aria-label="Chat settings" className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <ChatSettingsPanel settings={settings} onChange={setSettings} models={models} onRetryModels={retry} disabled={state.streaming} />
        <button type="button" className={secondaryButtonClass} onClick={() => clear()} disabled={state.messages.length === 0}>
          <MessageSquarePlus className="lucide" /> New chat
        </button>
      </aside>

      <section aria-label="Conversation" className="flex min-h-[60vh] flex-col gap-4">
        {state.messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Chat with a local model through Ollama. Replies appear word by word; nothing is saved on the server.
          </div>
        ) : (
          <ol className="space-y-3" aria-live="polite">
            {state.messages.map((message, index) => (
              <Bubble key={index} message={message} writing={state.streaming && index === state.messages.length - 1} />
            ))}
          </ol>
        )}
        <ReplyFooter state={state} onRegenerate={regenerate} />
        <div ref={end} />

        <div className="sticky bottom-0 mt-auto flex items-end gap-2 bg-stone-50 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:bg-stone-950">
          <textarea
            aria-label="Message"
            rows={2}
            className={`${fieldClass} resize-none`}
            placeholder={ready ? "Message the model (Enter to send, Shift Enter for a new line)" : "Waiting for a model…"}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {state.streaming ? (
            <button type="button" className={primaryButtonClass} onClick={stop}>
              <Square className="lucide" /> Stop
            </button>
          ) : (
            <button type="button" className={primaryButtonClass} onClick={submit} disabled={!canSend}>
              <Send className="lucide" /> Send
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
