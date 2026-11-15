// Remembers the last text and questions in this browser; storage that is blocked or holds something broken is ignored.

import { QUESTION_TYPES, type QuestionDraft } from "./questions";

const KEY = "laya-playground:draft";

export interface Draft {
  text: string;
  questions: QuestionDraft[];
}

function isQuestion(value: unknown): value is QuestionDraft {
  if (typeof value !== "object" || value === null) return false;
  const question = value as Partial<QuestionDraft>;
  const knownType = QUESTION_TYPES.some((type) => type.value === question.type);
  return knownType && typeof question.instruction === "string" && Array.isArray(question.options) && Array.isArray(question.levels);
}

export function loadDraft(): Draft | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return null;
    const { text, questions } = saved as Partial<Draft>;
    if (typeof text !== "string" || !Array.isArray(questions) || !questions.every(isQuestion)) return null;
    return { text, questions };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private mode or full storage: the draft just is not remembered
  }
}
