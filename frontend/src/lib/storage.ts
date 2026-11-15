// Remembers each tab's last state in this browser; storage that is blocked or holds something broken is ignored.

import type { ChatMessage, ChatSettings } from "./chat";
import { QUESTION_TYPES, type QuestionDraft } from "./questions";

const DRAFT_KEY = "laya-playground:draft";
const CHAT_KEY = "laya-playground:chat";
const TAB_KEY = "laya-playground:tab";
// index.html reads this key too, to apply the theme before the first paint
const THEME_KEY = "laya-playground:theme";

export interface Draft {
  text: string;
  questions: QuestionDraft[];
}

export interface SavedChat {
  settings: ChatSettings;
  messages: ChatMessage[];
}

export type Tab = "decide" | "chat";

export type ThemeChoice = "system" | "light" | "dark";

function read<T>(key: string, check: (value: unknown) => value is T): T | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return check(saved) ? saved : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: it just is not remembered
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function isQuestion(value: unknown): value is QuestionDraft {
  if (!isObject(value)) return false;
  const knownType = QUESTION_TYPES.some((type) => type.value === value.type);
  return knownType && typeof value.instruction === "string" && Array.isArray(value.options) && Array.isArray(value.levels);
}

function isDraft(value: unknown): value is Draft {
  return isObject(value) && typeof value.text === "string" && Array.isArray(value.questions) && value.questions.every(isQuestion);
}

function isMessage(value: unknown): value is ChatMessage {
  return isObject(value) && (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
}

const isNumberOrNull = (value: unknown): boolean => value === null || typeof value === "number";

function isChatSettings(value: unknown): value is ChatSettings {
  if (!isObject(value) || typeof value.model !== "string" || typeof value.system !== "string") return false;
  return isNumberOrNull(value.temperature) && isNumberOrNull(value.maxTokens);
}

function isSavedChat(value: unknown): value is SavedChat {
  return isObject(value) && isChatSettings(value.settings) && Array.isArray(value.messages) && value.messages.every(isMessage);
}

const isTab = (value: unknown): value is Tab => value === "decide" || value === "chat";
const isTheme = (value: unknown): value is ThemeChoice => value === "system" || value === "light" || value === "dark";

export const loadDraft = () => read(DRAFT_KEY, isDraft);
export const saveDraft = (draft: Draft) => write(DRAFT_KEY, draft);
export const loadChat = () => read(CHAT_KEY, isSavedChat);
export const saveChat = (chat: SavedChat) => write(CHAT_KEY, chat);
export const loadTab = () => read(TAB_KEY, isTab);
export const saveTab = (tab: Tab) => write(TAB_KEY, tab);
export const loadTheme = () => read(THEME_KEY, isTheme);
export const saveTheme = (theme: ThemeChoice) => write(THEME_KEY, theme);
