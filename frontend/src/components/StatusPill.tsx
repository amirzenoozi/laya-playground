import { useEffect, useState } from "react";
import { fetchStatus, type Status } from "../lib/laya";
import { Badge, type Tone } from "./ui";

type Loaded = { state: "pending" } | { state: "failed" } | { state: "settled"; status: Status };

function describe(loaded: Loaded): { text: string; tone: Tone } {
  if (loaded.state === "pending") return { text: "Checking…", tone: "neutral" };
  if (loaded.state === "failed") return { text: "Server unreachable", tone: "danger" };
  if (!loaded.status.model_found) return { text: "Model files missing", tone: "danger" };
  return loaded.status.loaded ? { text: "Laya loaded", tone: "success" } : { text: "Laya unloaded", tone: "neutral" };
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

  const { text, tone } = describe(loaded);
  return (
    <Badge tone={tone} dot>
      {text}
    </Badge>
  );
}
