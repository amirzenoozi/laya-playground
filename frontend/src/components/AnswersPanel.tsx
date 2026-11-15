import { CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import { answerLabels, type QuestionBody } from "../lib/questions";
import type { Answer } from "../lib/stream";
import type { Run } from "../lib/useAsk";
import { cardClass, secondaryButtonClass } from "./ui";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Bars({ answer }: { answer: Answer }) {
  return (
    <ul className="space-y-1.5">
      {answer.probabilities.map((option) => {
        const winner = option.label === answer.winner;
        return (
          <li key={option.label} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 text-sm">
            <span className={`truncate ${winner ? "font-semibold" : "text-stone-600 dark:text-stone-400"}`}>{option.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ${winner ? "bg-indigo-500" : "bg-stone-400 dark:bg-stone-600"}`}
                style={{ width: percent(option.probability) }}
              />
            </span>
            <span className="text-right tabular-nums text-stone-500">{percent(option.probability)}</span>
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
    <p className="text-xs text-stone-500">
      Expected level {answer.score.toFixed(2)} on a scale of 0 to {top}
    </p>
  );
}

function AnswerCard({ number, question, answer, waiting }: { number: number; question: QuestionBody; answer?: Answer; waiting: boolean }) {
  return (
    <article aria-label={`Answer ${number}`} className={`${cardClass} space-y-3`}>
      <header className="flex items-start gap-2">
        <span className="text-sm font-semibold text-stone-500">Q{number}</span>
        <h3 className="min-w-0 flex-1 text-sm">{question.instruction}</h3>
        {answer && <span className="shrink-0 text-xs tabular-nums text-stone-500">{answer.ms} ms</span>}
      </header>
      {answer ? (
        <>
          <p className="text-lg font-semibold">
            {answer.winner}
            <span className="ml-2 text-sm font-normal text-stone-500">confidence {percent(answer.confidence)}</span>
          </p>
          <Bars answer={answer} />
          <ScoreLine answer={answer} question={question} />
        </>
      ) : (
        <AnswerPlaceholder waiting={waiting} />
      )}
    </article>
  );
}

function AnswerPlaceholder({ waiting }: { waiting: boolean }) {
  if (!waiting) return <p className="text-sm text-stone-500">Not answered</p>;
  return (
    <div role="status" aria-label="Waiting for the answer" className="animate-pulse space-y-2">
      <div className="h-5 w-1/3 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-2 rounded bg-stone-100 dark:bg-stone-800" />
      <div className="h-2 w-5/6 rounded bg-stone-100 dark:bg-stone-800" />
    </div>
  );
}

function RunStatus({ run, onRetry }: { run: Run; onRetry: () => void }) {
  if (run.loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
        <LoaderCircle className="lucide animate-spin" /> Loading Laya, the first question takes a few seconds…
      </p>
    );
  }
  if (run.phase === "failed" && run.error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <CircleAlert className="lucide shrink-0" />
        <span className="min-w-0 flex-1">
          {run.error.message}
          {run.error.traceId && <span className="block text-xs opacity-75">Trace id {run.error.traceId}</span>}
        </span>
        <button type="button" className={secondaryButtonClass} onClick={onRetry}>
          <RotateCcw className="lucide" /> Retry
        </button>
      </div>
    );
  }
  return <Timings run={run} />;
}

function Timings({ run }: { run: Run }) {
  if (run.phase === "stopped") return <p className="text-sm text-stone-500">Stopped.</p>;
  if (run.phase !== "done" || run.totalMs === null) return null;
  const loaded = run.loadMs === null ? "" : `, of which ${run.loadMs} ms loading Laya`;
  return (
    <p className="text-sm text-stone-500">
      Answered in {run.totalMs} ms{loaded}.
    </p>
  );
}

export function AnswersPanel({ run, onRetry }: { run: Run; onRetry: () => void }) {
  if (!run.asked) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
        Write a text and a question, then press Ask. Answers appear here as Laya gives them.
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
