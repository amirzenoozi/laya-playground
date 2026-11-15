import { RotateCcw } from "lucide-react";
import type { ChatSettings, ModelInfo } from "../lib/chat";
import { shortModelName } from "../lib/chat";
import { fieldClass, secondaryButtonClass } from "./ui";

export type Models = { state: "pending" } | { state: "failed"; message: string } | { state: "settled"; models: ModelInfo[] };

interface Props {
  settings: ChatSettings;
  onChange: (settings: ChatSettings) => void;
  models: Models;
  onRetryModels: () => void;
  disabled: boolean;
}

const gigabytes = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

function ModelPicker({ settings, onChange, models, onRetryModels, disabled }: Props) {
  if (models.state === "pending") return <div role="status" aria-label="Loading models" className="h-10 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800" />;
  if (models.state === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <span className="min-w-0 flex-1">{models.message}</span>
        <button type="button" className={secondaryButtonClass} onClick={onRetryModels}>
          <RotateCcw className="lucide" /> Retry
        </button>
      </div>
    );
  }
  if (models.models.length === 0) {
    return <p className="text-sm text-stone-500">Ollama has no models yet. Pull one with `ollama pull`, then reload.</p>;
  }
  return (
    <select
      aria-label="Model"
      className={fieldClass}
      value={settings.model}
      disabled={disabled}
      onChange={(event) => onChange({ ...settings, model: event.target.value })}
    >
      {models.models.map((model) => (
        <option key={model.name} value={model.name}>
          {shortModelName(model.name)} · {model.parameters || "?"} · {gigabytes(model.size)}
        </option>
      ))}
    </select>
  );
}

// An empty box means the model's own default, so `null` is sent as nothing.
function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number | null; onChange: (value: number | null) => void; min: number; max: number; step: number }) {
  return (
    <label className="block text-xs font-medium text-stone-500">
      {label}
      <input
        type="number"
        className={`${fieldClass} mt-1`}
        min={min}
        max={max}
        step={step}
        placeholder="Model default"
        value={value ?? ""}
        onChange={(event) => {
          const typed = event.target.value === "" ? null : Number(event.target.value);
          if (typed === null || Number.isNaN(typed)) return onChange(null);
          // A step of 1 means a whole number, which the server requires for max tokens
          const whole = step >= 1 ? Math.round(typed) : typed;
          onChange(Math.min(max, Math.max(min, whole)));
        }}
      />
    </label>
  );
}

export function ChatSettingsPanel(props: Props) {
  const { settings, onChange } = props;
  return (
    <div className="space-y-3">
      <ModelPicker {...props} />
      <details className="rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-800">
        <summary className="cursor-pointer text-stone-600 select-none dark:text-stone-300">System prompt and options</summary>
        <div className="mt-3 space-y-3 pb-1">
          <label className="block text-xs font-medium text-stone-500">
            System prompt (optional)
            <textarea
              rows={3}
              className={`${fieldClass} mt-1`}
              placeholder="e.g. Answer in one short paragraph."
              value={settings.system}
              onChange={(event) => onChange({ ...settings, system: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Temperature (0 to 2)" min={0} max={2} step={0.1} value={settings.temperature} onChange={(temperature) => onChange({ ...settings, temperature })} />
            <NumberField label="Max tokens (1 to 8192)" min={1} max={8192} step={1} value={settings.maxTokens} onChange={(maxTokens) => onChange({ ...settings, maxTokens })} />
          </div>
        </div>
      </details>
    </div>
  );
}
