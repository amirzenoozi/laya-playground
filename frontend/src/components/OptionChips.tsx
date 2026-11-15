import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { parseLevel, parseOption, type Option } from "../lib/questions";
import { fieldClass } from "./ui";

interface Props {
  label: string;
  options: Option[];
  onChange: (options: Option[]) => void;
  placeholder: string;
  // "label: description" when true; score levels have labels only
  descriptions: boolean;
}

// Enter adds the typed option, a pasted list adds one per line, and Backspace in an empty box removes the last.
export function OptionChips({ label, options, onChange, placeholder, descriptions }: Props) {
  const [typed, setTyped] = useState("");

  const add = (text: string) => {
    const lines = text.split("\n").map(descriptions ? parseOption : parseLevel);
    const added = lines.filter((option): option is Option => option !== null);
    if (added.length > 0) onChange([...options, ...added]);
    setTyped("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add(typed);
    } else if (event.key === "Backspace" && typed === "" && options.length > 0) {
      onChange(options.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-500">{label}</label>
      {options.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {options.map((option, index) => (
            <li
              key={`${option.label}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-full bg-indigo-50 py-0.5 pr-0.5 pl-2.5 text-sm text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100"
            >
              <span className="truncate">
                {option.label}
                {option.description && <span className="text-indigo-700/70 dark:text-indigo-200/60">: {option.description}</span>}
              </span>
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                title={`Remove ${option.label}`}
                onClick={() => onChange(options.filter((_, kept) => kept !== index))}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/25 pointer-coarse:size-8"
              >
                <X className="lucide size-3.5!" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={fieldClass}
        value={typed}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          if (pasted.includes("\n")) {
            event.preventDefault();
            add(pasted);
          }
        }}
        onBlur={() => typed.trim() && add(typed)}
      />
    </div>
  );
}
