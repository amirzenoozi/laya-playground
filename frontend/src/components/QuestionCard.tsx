import { Copy, Trash2 } from "lucide-react";
import { QUESTION_TYPES, questionProblem, type QuestionDraft } from "../lib/questions";
import { OptionChips } from "./OptionChips";
import { cardClass, fieldClass, iconButtonClass } from "./ui";

interface Props {
  number: number;
  question: QuestionDraft;
  onChange: (question: QuestionDraft) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function TypeSwitch({ question, onChange }: Pick<Props, "question" | "onChange">) {
  return (
    <div role="radiogroup" aria-label="Answer type" className="inline-flex rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800">
      {QUESTION_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          role="radio"
          aria-checked={question.type === type.value}
          onClick={() => onChange({ ...question, type: type.value })}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-stone-600 aria-checked:bg-white aria-checked:text-stone-900 aria-checked:shadow-sm dark:text-stone-300 dark:aria-checked:bg-stone-950 dark:aria-checked:text-stone-100 pointer-coarse:py-2.5"
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

function Answers({ question, onChange }: Pick<Props, "question" | "onChange">) {
  if (question.type === "choice") {
    return (
      <OptionChips
        label="Options"
        descriptions
        options={question.options}
        onChange={(options) => onChange({ ...question, options })}
        placeholder="Type an option, Enter to add (label: optional description)"
      />
    );
  }
  if (question.type === "score") {
    return (
      <OptionChips
        label="Levels, lowest first"
        descriptions={false}
        options={question.levels.map((level) => ({ label: level, description: "" }))}
        onChange={(levels) => onChange({ ...question, levels: levels.map((level) => level.label) })}
        placeholder="Type a level, Enter to add"
      />
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input
        className={fieldClass}
        aria-label="Yes means (optional)"
        placeholder="Yes means… (optional)"
        value={question.yes}
        onChange={(event) => onChange({ ...question, yes: event.target.value })}
      />
      <input
        className={fieldClass}
        aria-label="No means (optional)"
        placeholder="No means… (optional)"
        value={question.no}
        onChange={(event) => onChange({ ...question, no: event.target.value })}
      />
    </div>
  );
}

export function QuestionCard({ number, question, onChange, onDuplicate, onRemove }: Props) {
  const problem = questionProblem(question);
  return (
    <section aria-label={`Question ${number}`} className={`${cardClass} space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-stone-500">Q{number}</span>
        <TypeSwitch question={question} onChange={onChange} />
        <div className="ml-auto flex">
          <button type="button" className={iconButtonClass} aria-label={`Duplicate question ${number}`} title="Duplicate" onClick={onDuplicate}>
            <Copy className="lucide" />
          </button>
          <button type="button" className={iconButtonClass} aria-label={`Remove question ${number}`} title="Remove" onClick={onRemove}>
            <Trash2 className="lucide" />
          </button>
        </div>
      </div>
      <input
        className={fieldClass}
        aria-label={`Question ${number}`}
        placeholder="What should Laya decide? e.g. Is the customer asking for a refund?"
        value={question.instruction}
        onChange={(event) => onChange({ ...question, instruction: event.target.value })}
      />
      <Answers question={question} onChange={onChange} />
      {problem && <p className="text-xs text-amber-700 dark:text-amber-400">{problem}</p>}
    </section>
  );
}
