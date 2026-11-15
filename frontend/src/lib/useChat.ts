import { useCallback, useEffect, useRef, useState } from "react";
import { chatBody, streamChat, type ChatEvent, type ChatMessage, type ChatSettings, type ReplyStats } from "./chat";

export interface ChatState {
  messages: ChatMessage[];
  // The last message is the reply being written
  streaming: boolean;
  stats: ReplyStats | null;
  error: { message: string; traceId?: string } | null;
}

export const EMPTY_CHAT: ChatState = { messages: [], streaming: false, stats: null, error: null };

function withReplyText(messages: ChatMessage[], text: string): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return messages;
  return [...messages.slice(0, -1), { ...last, content: last.content + text }];
}

// A reply that ended without a word is dropped, so it never shows as an empty bubble or reaches the next request.
function withoutEmptyReply(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  return last?.role === "assistant" && !last.content ? messages.slice(0, -1) : messages;
}

export function applyChatEvent(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === "token") return { ...state, messages: withReplyText(state.messages, event.text) };
  const messages = withoutEmptyReply(state.messages);
  if (event.type === "done") return { ...state, messages, streaming: false, stats: event.stats };
  return { ...state, messages, streaming: false, error: { message: event.message, traceId: event.traceId } };
}

function ended(state: ChatState, error: ChatState["error"]): ChatState {
  return state.streaming ? { ...state, messages: withoutEmptyReply(state.messages), streaming: false, error } : state;
}

// The history to send again: everything up to and including the last question.
function upToLastQuestion(messages: ChatMessage[]): ChatMessage[] {
  const last = messages.map((message) => message.role).lastIndexOf("user");
  return messages.slice(0, last + 1);
}

export interface Chat {
  state: ChatState;
  send: (text: string) => void;
  regenerate: () => void;
  stop: () => void;
  clear: () => void;
}

export function useChat(settings: ChatSettings, saved: ChatMessage[]): Chat {
  const [state, setState] = useState<ChatState>({ ...EMPTY_CHAT, messages: saved });
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    (history: ChatMessage[]) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ messages: [...history, { role: "assistant", content: "" }], streaming: true, stats: null, error: null });
      const isLatest = () => controller.current === current && !current.signal.aborted;
      const onEvent = (event: ChatEvent) => {
        if (isLatest()) setState((previous) => applyChatEvent(previous, event));
      };
      streamChat(chatBody(settings, history), onEvent, current.signal)
        .then(() => {
          if (isLatest()) setState((previous) => ended(previous, { message: "The server stopped before the reply ended" }));
        })
        .catch(() => {
          if (controller.current !== current) return;
          const error = current.signal.aborted ? null : { message: "Could not reach the server; is it running?" };
          setState((previous) => ended(previous, error));
        });
    },
    [settings],
  );

  const send = useCallback((text: string) => run([...state.messages, { role: "user", content: text }]), [run, state.messages]);
  const regenerate = useCallback(() => run(upToLastQuestion(state.messages)), [run, state.messages]);
  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(EMPTY_CHAT);
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, send, regenerate, stop, clear };
}
