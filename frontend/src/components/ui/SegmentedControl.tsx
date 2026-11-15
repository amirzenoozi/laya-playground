import type { KeyboardEvent, ReactNode } from "react";
import { focusRing } from "./classes";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  // "tab" switches panels (each segment controls `panel-<value>`); "radio" picks a value
  kind?: "radio" | "tab";
  // Show icons only, keeping the label as the accessible name and tooltip
  iconsOnly?: boolean;
  size?: "sm" | "md";
}

// Arrow keys move the choice, as in a native radio group.
function nextValue<T extends string>(segments: Segment<T>[], value: T, key: string): T | null {
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (step === 0) return null;
  const index = segments.findIndex((segment) => segment.value === value);
  return segments[(index + step + segments.length) % segments.length]!.value;
}

export function SegmentedControl<T extends string>({ label, segments, value, onChange, kind = "radio", iconsOnly = false, size = "md" }: Props<T>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextValue(segments, value, event.key);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };
  const padding = iconsOnly ? "size-7 pointer-coarse:size-10" : size === "sm" ? "px-2.5 py-1 text-xs pointer-coarse:py-2" : "px-3.5 py-1.5 text-sm pointer-coarse:py-2.5";
  return (
    <div role={kind === "tab" ? "tablist" : "radiogroup"} aria-label={label} onKeyDown={onKeyDown} className="inline-flex items-center gap-0.5 rounded-lg bg-sunken p-0.5 ring-1 ring-line ring-inset">
      {segments.map((segment) => {
        const selected = segment.value === value;
        const roleProps =
          kind === "tab"
            ? { role: "tab", id: `tab-${segment.value}`, "aria-selected": selected, "aria-controls": `panel-${segment.value}` }
            : { role: "radio", "aria-checked": selected };
        return (
          <button
            key={segment.value}
            type="button"
            data-value={segment.value}
            tabIndex={selected ? 0 : -1}
            title={iconsOnly ? segment.label : undefined}
            aria-label={iconsOnly ? segment.label : undefined}
            onClick={() => onChange(segment.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all ${padding} ${focusRing} ${
              selected ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
            }`}
            {...roleProps}
          >
            {segment.icon}
            {!iconsOnly && segment.label}
          </button>
        );
      })}
    </div>
  );
}
