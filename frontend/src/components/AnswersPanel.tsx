import { LoaderCircle, Sparkles, Trophy } from "lucide-react";
import { answerLabels, type QuestionBody } from "../lib/questions";
import type { Answer } from "../lib/laya";
import type { Run } from "../lib/useAsk";
import { QUESTION_STYLE, TypeBadge } from "./questionStyle";
import { Alert, Badge, Skeleton } from "./ui";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Bars({ answer }: { answer: Answer }) {
  return (
    <ul className="space-y-2">
      {answer.probabilities.map((option) => {
        const winner = option.label === answer.winner;
        return (
          <li key={option.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm">
            <span className={`truncate ${winner ? "font-semibold text-fg" : "text-muted"}`}>{option.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-sunken">
              <span
                className={`block h-full rounded-full motion-safe:animate-grow ${winner ? "bg-gradient-to-r from-accent to-violet-500" : "bg-line-strong"}`}
                style={{ width: percent(option.probability) }}
              />
            </span>
            <span className={`text-right tabular-nums ${winner ? "font-medium text-fg" : "text-subtle"}`}>{percent(option.probability)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ScoreLine({ answer, question }: { answer: Answer; question: QuestionBody }) {
  if (answer.score === null) return null;
  const top = answerLabels(question).length - 1;
  return (
    <p className="text-xs text-muted">
      Expected level {answer.score.toFixed(2)} on a scale of 0 to {top}
    </p>
  );
}

function AnswerPlaceholder({ waiting }: { waiting: boolean }) {
  if (!waiting) return <p className="text-sm text-subtle">Not answered</p>;
  return (
    <div role="status" aria-label="Waiting for the answer" className="space-y-2.5">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-2" />
      <Skeleton className="h-2 w-5/6" />
    </div>
  );
}

function AnswerCard({ number, question, answer, waiting }: { number: number; question: QuestionBody; answer?: Answer; waiting: boolean }) {
  return (
    <article aria-label={`Answer ${number}`} className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 pl-5 motion-safe:animate-rise">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${QUESTION_STYLE[question.type].stripe}`} />
      <header className="mb-3 flex items-start gap-2">
        <TypeBadge type={question.type} number={number} />
        <h3 className="min-w-0 flex-1 text-sm text-muted">{question.instruction}</h3>
        {answer && <span className="shrink-0 font-mono text-xs text-subtle tabular-nums">{answer.ms} ms</span>}
      </header>
      {answer ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="lucide text-accent-text" />
            <p className="text-lg font-semibold tracking-tight">{answer.winner}</p>
            <Badge tone="accent">confidence {percent(answer.confidence)}</Badge>
          </div>
          <Bars answer={answer} />
          <ScoreLine answer={answer} question={question} />
        </div>
      ) : (
        <AnswerPlaceholder waiting={waiting} />
      )}
    </article>
  );
}

// The run's state for the Answers card's header.
export function RunBadge({ run }: { run: Run }) {
  const total = run.asked?.questions.length ?? 0;
  const answered = run.answers.filter(Boolean).length;
  if (run.phase === "running") {
    return (
      <Badge tone="accent" dot pulse>
        {run.loading ? "Loading model" : `Answering ${Math.min(answered + 1, total)} of ${total}`}
      </Badge>
    );
  }
  if (run.phase === "done") return <Badge tone="success" dot>Done</Badge>;
  if (run.phase === "failed") return <Badge tone="danger" dot>Failed</Badge>;
  if (run.phase === "stopped") return <Badge dot>Stopped</Badge>;
  return null;
}

function RunStatus({ run, onRetry }: { run: Run; onRetry: () => void }) {
  if (run.loading) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-accent-soft-fg">
        <LoaderCircle className="lucide motion-safe:animate-spin" /> Loading Laya, the first question takes a few seconds…
      </p>
    );
  }
  if (run.phase === "failed" && run.error) return <Alert message={run.error.message} traceId={run.error.traceId} onRetry={onRetry} />;
  if (run.phase !== "done" || run.totalMs === null) return null;
  const loaded = run.loadMs === null ? "" : `, of which ${run.loadMs} ms loading Laya`;
  return (
    <p className="text-sm text-muted">
      Answered in {run.totalMs} ms{loaded}.
    </p>
  );
}

export function AnswersPanel({ run, onRetry }: { run: Run; onRetry: () => void }) {
  if (!run.asked) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
          <Sparkles className="lucide size-5!" />
        </span>
        <p className="max-w-xs text-sm text-muted">Write a text and a question, then press Ask. Answers appear here as Laya gives them.</p>
      </div>
    );
  }
  const waiting = run.phase === "running";
  return (
    <div className="space-y-3" aria-live="polite">
      <RunStatus run={run} onRetry={onRetry} />
      {run.asked.questions.map((question, index) => (
        <AnswerCard key={index} number={index + 1} question={question} answer={run.answers[index]} waiting={waiting} />
      ))}
    </div>
  );
}
