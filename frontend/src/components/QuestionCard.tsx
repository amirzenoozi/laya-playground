import { CircleAlert, Copy, Trash2 } from "lucide-react";
import { QUESTION_TYPES, questionProblem, type QuestionDraft, type QuestionType } from "../lib/questions";
import { OptionChips } from "./OptionChips";
import { QUESTION_STYLE, TypeBadge } from "./questionStyle";
import { fieldClass, IconButton, SegmentedControl } from "./ui";

interface Props {
  number: number;
  question: QuestionDraft;
  onChange: (question: QuestionDraft) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function Answers({ question, onChange }: Pick<Props, "question" | "onChange">) {
  if (question.type === "choice") {
    return (
      <OptionChips
        label="Options"
        descriptions
        options={question.options}
        onChange={(options) => onChange({ ...question, options })}
        placeholder="Type an option and press Enter (label: optional description)"
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
        placeholder="Type a level and press Enter"
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

const TYPE_SEGMENTS = QUESTION_TYPES.map((type) => ({ value: type.value, label: type.label, icon: QUESTION_STYLE[type.value].icon }));

export function QuestionCard({ number, question, onChange, onDuplicate, onRemove }: Props) {
  const problem = questionProblem(question);
  return (
    <section
      aria-label={`Question ${number}`}
      className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 pl-5 shadow-xs transition-shadow focus-within:shadow-md motion-safe:animate-rise"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${QUESTION_STYLE[question.type].stripe}`} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TypeBadge type={question.type} number={number} />
        <SegmentedControl<QuestionType>
          label="Answer type"
          size="sm"
          segments={TYPE_SEGMENTS}
          value={question.type}
          onChange={(type) => onChange({ ...question, type })}
        />
        <div className="ml-auto flex">
          <IconButton label={`Duplicate question ${number}`} onClick={onDuplicate}>
            <Copy className="lucide" />
          </IconButton>
          <IconButton label={`Remove question ${number}`} onClick={onRemove} className="hover:text-danger">
            <Trash2 className="lucide" />
          </IconButton>
        </div>
      </div>
      <div className="space-y-3">
        <input
          className={fieldClass}
          aria-label={`Question ${number}`}
          placeholder="What should Laya decide? e.g. Is the customer asking for a refund?"
          value={question.instruction}
          onChange={(event) => onChange({ ...question, instruction: event.target.value })}
        />
        <Answers question={question} onChange={onChange} />
        {problem && (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <CircleAlert className="lucide size-3.5!" /> {problem}
          </p>
        )}
      </div>
    </section>
  );
}
