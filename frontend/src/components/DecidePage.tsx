import { Braces, Check, Copy, MessageSquareText, Plus, Send, Square, Telescope } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
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
import { useCopy } from "../lib/useCopy";
import { AnswersPanel, RunBadge } from "./AnswersPanel";
import { QuestionCard } from "./QuestionCard";
import { StatusPill } from "./StatusPill";
import { Button, Card, fieldClass, labelClass } from "./ui";

function JsonView({ text, questions }: { text: string; questions: QuestionDraft[] }) {
  const { copied, copy } = useCopy();
  const json = JSON.stringify(askBody(text, questions), null, 2);
  return (
    <div className="relative motion-safe:animate-rise">
      <Button size="sm" onClick={() => copy(json)} icon={copied ? <Check className="lucide" /> : <Copy className="lucide" />} className="absolute top-2 right-2">
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre aria-label="Request JSON" className="max-h-80 overflow-auto rounded-xl border border-line bg-sunken p-4 font-mono text-xs leading-relaxed text-fg">
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

function Templates({ disabled, onPick }: { disabled: boolean; onPick: (question: QuestionDraft) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={labelClass}>Start from</span>
      {TEMPLATES.map((template) => (
        <Button key={template.name} size="sm" disabled={disabled} onClick={() => onPick(fromTemplate(template))}>
          {template.name}
        </Button>
      ))}
    </div>
  );
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
    <div onKeyDown={onKeyDown} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card title="Ask" icon={<MessageSquareText className="lucide" />} actions={<StatusPill refresh={run.phase} />} bodyClassName="space-y-5 p-4 sm:p-5">
        <div className="space-y-1.5">
          <label htmlFor="text" className={`flex justify-between ${labelClass}`}>
            Text to judge
            <span className="font-normal text-subtle tabular-nums">
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
            </span>
          </label>
          <textarea
            id="text"
            rows={5}
            className={`${fieldClass} resize-y leading-relaxed`}
            placeholder="Paste a message, a review, a prompt…"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        <Templates disabled={full} onPick={add} />

        <div className="space-y-3">
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
          <button
            type="button"
            disabled={full}
            onClick={() => add(blankQuestion())}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-3 text-sm font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="lucide" /> Add question {full && `(at most ${MAX_QUESTIONS})`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {running ? (
            <Button variant="primary" onClick={stop} icon={<Square className="lucide" />}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" disabled={problem !== null} onClick={send} title="Ask (⌘ Enter)" icon={<Send className="lucide" />}>
              Ask
            </Button>
          )}
          <Button variant="ghost" aria-pressed={showJson} onClick={() => setShowJson(!showJson)} icon={<Braces className="lucide" />} className="aria-pressed:bg-sunken aria-pressed:text-fg">
            JSON
          </Button>
          {problem ? <span className="text-sm text-muted">{problem}</span> : <kbd className="ml-auto hidden font-mono text-xs text-subtle sm:inline">⌘ Enter</kbd>}
        </div>
        {showJson && <JsonView text={text} questions={questions} />}
      </Card>

      <Card title="Answers" icon={<Telescope className="lucide" />} actions={<RunBadge run={run} />} className="lg:sticky lg:top-20">
        <AnswersPanel run={run} onRetry={retry} />
      </Card>
    </div>
  );
}
