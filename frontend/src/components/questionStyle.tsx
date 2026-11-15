import { Gauge, ListChecks, ToggleRight } from "lucide-react";
import type { ReactNode } from "react";
import type { QuestionType } from "../lib/questions";

interface Style {
  icon: ReactNode;
  // The type's mark: a coloured stripe on its question and a tint on its badge
  stripe: string;
  tint: string;
}

// One colour per answer type, the same on the question card and its answer.
export const QUESTION_STYLE: Record<QuestionType, Style> = {
  noul: {
    icon: <ToggleRight className="lucide" />,
    stripe: "bg-emerald-500",
    tint: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  },
  choice: {
    icon: <ListChecks className="lucide" />,
    stripe: "bg-violet-500",
    tint: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  },
  score: {
    icon: <Gauge className="lucide" />,
    stripe: "bg-amber-500",
    tint: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
};

export function TypeBadge({ type, number }: { type: QuestionType; number: number }) {
  const style = QUESTION_STYLE[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.tint}`}>
      {style.icon}Q{number}
    </span>
  );
}
