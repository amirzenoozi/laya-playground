import { Bot, Check, Copy, MessageSquarePlus, MessagesSquare, RotateCcw, Send, SlidersHorizontal, Square, User } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { fetchModels, shortModelName, type ChatMessage, type ChatSettings, type ReplyStats } from "../lib/chat";
import { loadChat, saveChat } from "../lib/storage";
import { useChat, type ChatState } from "../lib/useChat";
import { useCopy } from "../lib/useCopy";
import { ChatSettingsPanel, type Models } from "./ChatSettingsPanel";
import { Alert, Badge, Button, Card, IconButton } from "./ui";

const DEFAULT_SETTINGS: ChatSettings = { model: "", system: "", temperature: null, maxTokens: null };

const EXAMPLE_PROMPTS = [
  "Explain what a decision model is in two sentences.",
  "Write a haiku about a quiet garden.",
  "Give me three names for a small coffee shop.",
  "List the pros and cons of working from home.",
];

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

function Avatar({ mine }: { mine: boolean }) {
  return mine ? (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted ring-1 ring-line">
      <User className="lucide" />
    </span>
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-white shadow-sm">
      <Bot className="lucide" />
    </span>
  );
}

function TypingDots() {
  return (
    <span role="status" aria-label="Waiting for the first words" className="inline-flex gap-1 py-1.5">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1.5 rounded-full bg-subtle motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function CopyReply({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <IconButton label={copied ? "Copied" : "Copy reply"} onClick={() => copy(text)} className="size-7">
      {copied ? <Check className="lucide text-success" /> : <Copy className="lucide" />}
    </IconButton>
  );
}

// Memoised: while a reply streams only its own bubble changes, so a long conversation does not re-render each token.
const Bubble = memo(function Bubble({ message, writing }: { message: ChatMessage; writing: boolean }) {
  const mine = message.role === "user";
  return (
    <li className={`group flex gap-3 motion-safe:animate-rise ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar mine={mine} />
      <div className={`flex max-w-[85%] min-w-0 flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
        <div
          aria-label={mine ? "You" : "Model"}
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
            mine ? "rounded-tr-md bg-accent text-white shadow-sm shadow-accent/20" : "rounded-tl-md bg-sunken text-fg ring-1 ring-line ring-inset"
          }`}
        >
          {writing && !message.content ? <TypingDots /> : message.content}
          {writing && message.content && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-accent motion-safe:animate-pulse" />}
        </div>
        {!mine && !writing && message.content && (
          <div className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 pointer-coarse:opacity-100">
            <CopyReply text={message.content} />
          </div>
        )}
      </div>
    </li>
  );
});

function statsText(stats: ReplyStats): string {
  return [
    stats.firstTokenMs === null ? null : `first words in ${stats.firstTokenMs} ms`,
    stats.tokens === null ? null : `${stats.tokens} tokens`,
    `${(stats.totalMs / 1000).toFixed(1)} s in total`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ReplyFooter({ state, onRegenerate }: { state: ChatState; onRegenerate: () => void }) {
  if (state.streaming || state.messages.length === 0) return null;
  if (state.error) return <Alert message={state.error.message} traceId={state.error.traceId} onRetry={onRegenerate} />;
  return (
    <div className="flex flex-wrap items-center gap-3 pl-11">
      <Button size="sm" variant="ghost" onClick={onRegenerate} icon={<RotateCcw className="lucide" />}>
        Regenerate
      </Button>
      {state.stats && <p className="font-mono text-xs text-subtle">{statsText(state.stats)}</p>}
    </div>
  );
}

function EmptyChat({ ready, onPick }: { ready: boolean; onPick: (prompt: string) => void }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-violet-500 text-white shadow-lg shadow-accent/25">
        <MessagesSquare className="lucide size-6!" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">Chat with a local model</p>
        <p className="text-sm text-muted">Replies appear word by word. Nothing is saved on the server.</p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={!ready}
            onClick={() => onPick(prompt)}
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-soft-fg focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// Follows the newest words while the reader is at the bottom, and leaves them be once they scroll up.
function useStickToBottom(changes: unknown) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [changes]);
  const onScroll = () => {
    const element = scroller.current;
    if (element) atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  };
  return { scroller, onScroll };
}

function Composer({ ready, streaming, onSend, onStop }: { ready: boolean; streaming: boolean; onSend: (text: string) => void; onStop: () => void }) {
  const [typed, setTyped] = useState("");
  const canSend = ready && typed.trim() !== "" && !streaming;
  const submit = () => {
    if (!canSend) return;
    onSend(typed.trim());
    setTyped("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-3 shadow-xs transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20">
        <textarea
          aria-label="Message"
          rows={1}
          className="max-h-48 min-h-9 flex-1 resize-none bg-transparent py-2 text-base leading-relaxed text-fg [field-sizing:content] placeholder:text-subtle focus:outline-none sm:text-sm"
          placeholder={ready ? "Message the model…" : "Waiting for a model…"}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming ? (
          <Button variant="primary" onClick={onStop} icon={<Square className="lucide" />} className="rounded-xl">
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={submit} disabled={!canSend} icon={<Send className="lucide" />} className="rounded-xl">
            Send
          </Button>
        )}
      </div>
      <p className="mt-1.5 hidden px-1 text-xs text-subtle sm:block">Enter to send, Shift Enter for a new line</p>
    </div>
  );
}

export function ChatPage() {
  const [saved] = useState(loadChat);
  const [settings, setSettings] = useState<ChatSettings>(saved?.settings ?? DEFAULT_SETTINGS);
  const { models, retry, ready } = useModels(settings, setSettings);
  const { state, send, regenerate, stop, clear } = useChat(settings, saved?.messages ?? []);
  const { scroller, onScroll } = useStickToBottom(state.messages);

  useEffect(() => {
    if (!state.streaming) saveChat({ settings, messages: state.messages });
  }, [settings, state.messages, state.streaming]);

  const modelBadge = ready ? <Badge tone={state.streaming ? "accent" : "neutral"} dot pulse={state.streaming}>{shortModelName(settings.model)}</Badge> : null;

  return (
    <div className="grid items-start gap-6 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <Card title="Settings" icon={<SlidersHorizontal className="lucide" />} label="Chat settings" className="lg:max-h-full lg:overflow-y-auto">
        <ChatSettingsPanel settings={settings} onChange={setSettings} models={models} onRetryModels={retry} disabled={state.streaming} />
      </Card>

      <Card
        title="Conversation"
        icon={<MessagesSquare className="lucide" />}
        actions={
          <>
            {modelBadge}
            <Button size="sm" variant="ghost" onClick={clear} disabled={state.messages.length === 0} icon={<MessageSquarePlus className="lucide" />}>
              New chat
            </Button>
          </>
        }
        className="flex h-[75dvh] min-h-0 flex-col lg:h-full"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
          {state.messages.length === 0 ? (
            <EmptyChat ready={ready} onPick={send} />
          ) : (
            <div className="space-y-4">
              <ol className="space-y-5" aria-live="polite">
                {state.messages.map((message, index) => (
                  <Bubble key={index} message={message} writing={state.streaming && index === state.messages.length - 1} />
                ))}
              </ol>
              <ReplyFooter state={state} onRegenerate={regenerate} />
            </div>
          )}
        </div>
        <Composer ready={ready} streaming={state.streaming} onSend={send} onStop={stop} />
      </Card>
    </div>
  );
}
