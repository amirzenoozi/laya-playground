import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "./Button";

interface Props {
  message: string;
  traceId?: string;
  onRetry?: () => void;
}

export function Alert({ message, traceId, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-soft p-3 text-sm text-danger ring-1 ring-danger/20 ring-inset motion-safe:animate-rise">
      <CircleAlert className="lucide" />
      <span className="min-w-0 flex-1">
        {message}
        {traceId && <span className="block font-mono text-xs opacity-75">Trace id {traceId}</span>}
      </span>
      {onRetry && (
        <Button size="sm" onClick={onRetry} icon={<RotateCcw className="lucide" />}>
          Retry
        </Button>
      )}
    </div>
  );
}
