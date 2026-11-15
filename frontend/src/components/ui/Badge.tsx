import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-muted ring-line",
  accent: "bg-accent-soft text-accent-soft-fg ring-accent/20",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Badge({ tone = "neutral", dot = false, pulse = false, children }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOTS[tone]} ${pulse ? "motion-safe:animate-pulse" : ""}`} />}
      {children}
    </span>
  );
}
