import { useEffect, useState } from "react";
import { fetchStatus, type Status } from "../lib/laya";

type Loaded = { state: "pending" } | { state: "failed" } | { state: "settled"; status: Status };

function describe(loaded: Loaded): { text: string; dot: string } {
  if (loaded.state === "pending") return { text: "Checking…", dot: "bg-stone-300" };
  if (loaded.state === "failed") return { text: "Server unreachable", dot: "bg-red-500" };
  if (!loaded.status.model_found) return { text: "Model files missing", dot: "bg-red-500" };
  return loaded.status.loaded ? { text: "Laya loaded", dot: "bg-emerald-500" } : { text: "Laya unloaded", dot: "bg-stone-400" };
}

// Rechecked whenever `refresh` changes, such as after each run, since loading and unloading happen on the server.
export function StatusPill({ refresh }: { refresh: unknown }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "pending" });

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal)
      .then((status) => setLoaded({ state: "settled", status }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ state: "failed" });
      });
    return () => controller.abort();
  }, [refresh]);

  const { text, dot } = describe(loaded);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-300">
      <span className={`size-2 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
