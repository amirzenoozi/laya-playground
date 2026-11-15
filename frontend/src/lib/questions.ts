// The questions being written, their checks (the same limits the server applies), and the request sent to it.

export const MAX_TEXT = 10_000;
export const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 20;
const MAX_LEVELS = 10;
const MAX_LABEL = 80;

export type QuestionType = "noul" | "choice" | "score";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "noul", label: "Yes / No" },
  { value: "choice", label: "Choice" },
  { value: "score", label: "Score" },
];

export interface Option {
  label: string;
  description: string;
}

// Every type's fields are kept, so switching type and back loses nothing typed.
export interface QuestionDraft {
  id: string;
  type: QuestionType;
  instruction: string;
  yes: string;
  no: string;
  options: Option[];
  levels: string[];
}

export type QuestionBody =
  | { type: "noul"; instruction: string; yes?: string; no?: string }
  | { type: "choice"; instruction: string; options: Option[] }
  | { type: "score"; instruction: string; levels: string[] };

export interface AskBody {
  text: string;
  questions: QuestionBody[];
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankQuestion(type: QuestionType = "noul"): QuestionDraft {
  return { id: newId(), type, instruction: "", yes: "", no: "", options: [], levels: [] };
}

// "delivery: shipping, parcels" is a label with a description; the first colon splits them.
export function parseOption(typed: string): Option | null {
  const colon = typed.indexOf(":");
  const label = (colon < 0 ? typed : typed.slice(0, colon)).trim().slice(0, MAX_LABEL);
  const description = colon < 0 ? "" : typed.slice(colon + 1).trim();
  return label ? { label, description } : null;
}

// A score level has no description, so a colon is part of its label.
export function parseLevel(typed: string): Option | null {
  const label = typed.trim().slice(0, MAX_LABEL);
  return label ? { label, description: "" } : null;
}

function hasRepeats(labels: string[]): boolean {
  const lowered = labels.map((label) => label.toLowerCase());
  return new Set(lowered).size !== lowered.length;
}

function listProblem(labels: string[], noun: string, max: number): string | null {
  if (labels.length < 2) return `Add at least two ${noun}`;
  if (labels.length > max) return `At most ${max} ${noun}`;
  return hasRepeats(labels) ? `Each of the ${noun} needs its own label` : null;
}

export function questionProblem(question: QuestionDraft): string | null {
  if (!question.instruction.trim()) return "Write the question";
  if (question.type === "choice") return listProblem(question.options.map((option) => option.label), "options", MAX_OPTIONS);
  if (question.type === "score") return listProblem(question.levels, "levels", MAX_LEVELS);
  return null;
}

export function askProblem(text: string, questions: QuestionDraft[]): string | null {
  if (!text.trim()) return "Write the text to judge";
  if (text.length > MAX_TEXT) return `The text is longer than ${MAX_TEXT.toLocaleString()} characters`;
  if (questions.length === 0) return "Add a question";
  const index = questions.findIndex((question) => questionProblem(question) !== null);
  return index < 0 ? null : `Question ${index + 1}: ${questionProblem(questions[index]!)}`;
}

function questionBody(question: QuestionDraft): QuestionBody {
  const instruction = question.instruction.trim();
  if (question.type === "choice") return { type: "choice", instruction, options: question.options };
  if (question.type === "score") return { type: "score", instruction, levels: question.levels };
  const answers = { yes: question.yes.trim(), no: question.no.trim() };
  return { type: "noul", instruction, ...(answers.yes && { yes: answers.yes }), ...(answers.no && { no: answers.no }) };
}

export function askBody(text: string, questions: QuestionDraft[]): AskBody {
  return { text: text.trim(), questions: questions.map(questionBody) };
}

// The answer's option labels, in the order they were asked.
export function answerLabels(question: QuestionBody): string[] {
  if (question.type === "choice") return question.options.map((option) => option.label);
  if (question.type === "score") return question.levels;
  return ["yes", "no"];
}

interface Template {
  name: string;
  question: Omit<QuestionDraft, "id">;
}

const blank = { yes: "", no: "", options: [], levels: [] };

export const TEMPLATES: Template[] = [
  {
    name: "Sentiment",
    question: {
      ...blank,
      type: "choice",
      instruction: "What is the overall sentiment of the text?",
      options: [
        { label: "positive", description: "" },
        { label: "neutral", description: "" },
        { label: "negative", description: "" },
      ],
    },
  },
  {
    name: "Yes / No check",
    question: { ...blank, type: "noul", instruction: "Does the text ask for help?" },
  },
  {
    name: "Urgency",
    question: {
      ...blank,
      type: "score",
      instruction: "How urgent is the text?",
      levels: ["not urgent", "somewhat urgent", "urgent", "critical"],
    },
  },
  {
    name: "Topic",
    question: {
      ...blank,
      type: "choice",
      instruction: "What is the text mainly about?",
      options: [
        { label: "billing", description: "payments, invoices, refunds" },
        { label: "delivery", description: "shipping, parcels, couriers" },
        { label: "account", description: "logging in, passwords, settings" },
        { label: "other", description: "" },
      ],
    },
  },
];

export function fromTemplate(template: Template): QuestionDraft {
  return { ...template.question, id: newId() };
}
