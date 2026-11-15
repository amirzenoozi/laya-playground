import { useEffect, useState } from "react";
import { ChatPage } from "./components/ChatPage";
import { DecidePage } from "./components/DecidePage";
import { loadTab, saveTab, type Tab } from "./lib/storage";

const TABS: { value: Tab; label: string }[] = [
  { value: "decide", label: "Decide" },
  { value: "chat", label: "Chat" },
];

export function App() {
  const [tab, setTab] = useState<Tab>(() => loadTab() ?? "decide");
  useEffect(() => saveTab(tab), [tab]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Laya playground</h1>
        <div role="tablist" aria-label="Mode" className="inline-flex rounded-lg bg-stone-200/70 p-0.5 dark:bg-stone-800">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`tab-${item.value}`}
              aria-selected={tab === item.value}
              aria-controls={`panel-${item.value}`}
              onClick={() => setTab(item.value)}
              className="rounded-md px-4 py-1.5 text-sm font-medium text-stone-600 aria-selected:bg-white aria-selected:text-stone-900 aria-selected:shadow-sm dark:text-stone-300 dark:aria-selected:bg-stone-950 dark:aria-selected:text-stone-100 pointer-coarse:py-2.5"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {/* Both stay mounted, so switching tabs keeps a running answer or reply going */}
      <main>
        <div role="tabpanel" id="panel-decide" aria-labelledby="tab-decide" hidden={tab !== "decide"}>
          <DecidePage />
        </div>
        <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" hidden={tab !== "chat"}>
          <ChatPage />
        </div>
      </main>
    </div>
  );
}
