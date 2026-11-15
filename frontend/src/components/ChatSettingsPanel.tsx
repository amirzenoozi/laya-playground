import { ChevronDown, Cpu } from "lucide-react";
import { useId } from "react";
import type { ChatSettings, ModelInfo } from "../lib/chat";
import { shortModelName } from "../lib/chat";
import { Alert, fieldClass, labelClass, Skeleton } from "./ui";

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
  if (models.state === "pending") {
    return (
      <div role="status" aria-label="Loading models">
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }
  if (models.state === "failed") return <Alert message={models.message} onRetry={onRetryModels} />;
  if (models.models.length === 0) {
    return <p className="rounded-lg bg-sunken p-3 text-sm text-muted">Ollama has no models yet. Pull one with `ollama pull`, then reload.</p>;
  }
  const selected = models.models.find((model) => model.name === settings.model);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Cpu className="lucide pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
        <select
          aria-label="Model"
          className={`${fieldClass} appearance-none truncate pr-9 pl-9`}
          value={settings.model}
          disabled={disabled}
          onChange={(event) => onChange({ ...settings, model: event.target.value })}
        >
          {models.models.map((model) => (
            <option key={model.name} value={model.name}>
              {shortModelName(model.name)}
            </option>
          ))}
        </select>
        <ChevronDown className="lucide pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-subtle" />
      </div>
      {selected && (
        <p className="text-xs text-subtle">
          {selected.parameters || "?"} parameters · {gigabytes(selected.size)}
        </p>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
}

// An empty box means the model's own default, so `null` is sent as nothing.
function NumberField({ label, value, onChange, min, max, step }: NumberFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={`${fieldClass} tabular-nums`}
        min={min}
        max={max}
        step={step}
        placeholder="Default"
        value={value ?? ""}
        onChange={(event) => {
          const typed = event.target.value === "" ? null : Number(event.target.value);
          if (typed === null || Number.isNaN(typed)) return onChange(null);
          // A step of 1 means a whole number, which the server requires for max tokens
          const whole = step >= 1 ? Math.round(typed) : typed;
          onChange(Math.min(max, Math.max(min, whole)));
        }}
      />
    </div>
  );
}

export function ChatSettingsPanel(props: Props) {
  const { settings, onChange } = props;
  const systemId = useId();
  return (
    <div className="space-y-4">
      <ModelPicker {...props} />
      <details className="group rounded-xl border border-line bg-sunken/50 open:bg-transparent">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted select-none hover:text-fg [&::-webkit-details-marker]:hidden">
          System prompt and options
          <ChevronDown className="lucide transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div className="space-y-1.5">
            <label htmlFor={systemId} className={labelClass}>
              System prompt (optional)
            </label>
            <textarea
              id={systemId}
              rows={3}
              className={`${fieldClass} resize-y`}
              placeholder="e.g. Answer in one short paragraph."
              value={settings.system}
              onChange={(event) => onChange({ ...settings, system: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Temperature (0 to 2)" min={0} max={2} step={0.1} value={settings.temperature} onChange={(temperature) => onChange({ ...settings, temperature })} />
            <NumberField label="Max tokens (1 to 8192)" min={1} max={8192} step={1} value={settings.maxTokens} onChange={(maxTokens) => onChange({ ...settings, maxTokens })} />
          </div>
        </div>
      </details>
    </div>
  );
}
