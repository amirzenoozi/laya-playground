import { Braces, Check, Plus, Send, Square } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { AnswersPanel } from "./AnswersPanel";
import { QuestionCard } from "./QuestionCard";
import { StatusPill } from "./StatusPill";
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import {
  askBody,
  askProblem,
  blankQuestion,
  fromTemplate,
  MAX_QUESTIONS,
  MAX_TEXT,
  newId,
  TEMPLATES,
  type QuestionDraft,
} from "../lib/questions";
import { loadDraft, saveDraft } from "../lib/storage";
import { useAsk } from "../lib/useAsk";

function JsonView({ text, questions }: { text: string; questions: QuestionDraft[] }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(askBody(text, questions), null, 2);
  const copy = () => {
    void navigator.clipboard?.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="relative">
      <button type="button" onClick={copy} className={`${secondaryButtonClass} absolute top-2 right-2 bg-white dark:bg-stone-900`}>
        {copied ? <Check className="lucide" /> : <Braces className="lucide" />} {copied ? "Copied" : "Copy"}
      </button>
      <pre aria-label="Request JSON" className="max-h-80 overflow-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100">
        {json}
      </pre>
    </div>
  );
}

function useDraft() {
  const [saved] = useState(loadDraft);
  const [text, setText] = useState(saved?.text ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(saved?.questions ?? [blankQuestion()]);
  useEffect(() => saveDraft({ text, questions }), [text, questions]);
  return { text, setText, questions, setQuestions };
}

export function DecidePage() {
  const { text, setText, questions, setQuestions } = useDraft();
  const [showJson, setShowJson] = useState(false);
  const { run, start, stop } = useAsk();
  const running = run.phase === "running";
  const problem = askProblem(text, questions);
  const full = questions.length >= MAX_QUESTIONS;

  const send = () => {
    if (!problem && !running) start(askBody(text, questions));
  };
  const retry = () => run.asked && start(run.asked);
  const add = (question: QuestionDraft) => !full && setQuestions([...questions, question]);
  const update = (index: number, question: QuestionDraft) => setQuestions(questions.map((old, at) => (at === index ? question : old)));
  const duplicate = (index: number) => add({ ...questions[index]!, id: newId() });
  const remove = (index: number) => setQuestions(questions.filter((_, at) => at !== index));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-stone-500">Ask Laya, a small decision model, typed questions about a text.</p>
        <div className="ml-auto">
          <StatusPill refresh={run.phase} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Ask" className="space-y-4">
          <div>
            <label htmlFor="text" className="mb-1 flex justify-between text-sm font-medium">
              Text to judge
              <span className="font-normal tabular-nums text-stone-500">
                {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
              </span>
            </label>
            <textarea
              id="text"
              rows={6}
              className={fieldClass}
              placeholder="Paste a message, a review, a prompt…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-stone-500">Start from</span>
            {TEMPLATES.map((template) => (
              <button key={template.name} type="button" disabled={full} className={secondaryButtonClass} onClick={() => add(fromTemplate(template))}>
                {template.name}
              </button>
            ))}
          </div>

          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              number={index + 1}
              question={question}
              onChange={(changed) => update(index, changed)}
              onDuplicate={() => duplicate(index)}
              onRemove={() => remove(index)}
            />
          ))}

          <button type="button" disabled={full} className={secondaryButtonClass} onClick={() => add(blankQuestion())}>
            <Plus className="lucide" /> Add question {full && `(at most ${MAX_QUESTIONS})`}
          </button>

          <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
            {running ? (
              <button type="button" className={primaryButtonClass} onClick={stop}>
                <Square className="lucide" /> Stop
              </button>
            ) : (
              <button type="button" className={primaryButtonClass} disabled={problem !== null} onClick={send} title="Ask (⌘ Enter)">
                <Send className="lucide" /> Ask
              </button>
            )}
            <button type="button" className={secondaryButtonClass} aria-pressed={showJson} onClick={() => setShowJson(!showJson)}>
              <Braces className="lucide" /> JSON
            </button>
            {problem && <span className="text-sm text-stone-500">{problem}</span>}
          </div>
          {showJson && <JsonView text={text} questions={questions} />}
        </section>

        <section aria-label="Answers" className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-3 text-sm font-medium">Answers</h2>
          <AnswersPanel run={run} onRetry={retry} />
        </section>
      </div>
    </div>
  );
}
