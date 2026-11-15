import { MessagesSquare, Scale, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { DecidePage } from "./components/DecidePage";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { SegmentedControl, Skeleton, type Segment } from "./components/ui";
import { loadTab, saveTab, type Tab } from "./lib/storage";

// Loaded the first time Chat is opened, so the first screen stays light
const ChatPage = lazy(() => import("./components/ChatPage").then((module) => ({ default: module.ChatPage })));

const TABS: Segment<Tab>[] = [
  { value: "decide", label: "Decide", icon: <Scale className="lucide" /> },
  { value: "chat", label: "Chat", icon: <MessagesSquare className="lucide" /> },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-500 text-white shadow-md shadow-accent/30">
        <Sparkles className="lucide" />
      </span>
      <div className="leading-tight">
        <h1 className="text-sm font-semibold">Laya playground</h1>
        <p className="hidden text-xs text-subtle sm:block">Local models, streamed</p>
      </div>
    </div>
  );
}

function ChatLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-[60dvh] rounded-2xl" />
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>(() => loadTab() ?? "decide");
  // Once opened, Chat stays mounted, so switching tabs keeps a reply streaming
  const [chatOpened, setChatOpened] = useState(tab === "chat");
  useEffect(() => {
    saveTab(tab);
    if (tab === "chat") setChatOpened(true);
  }, [tab]);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(55%_60%_at_50%_0%,rgb(99_102_241/0.14),transparent_70%)] dark:bg-[radial-gradient(55%_60%_at_50%_0%,rgb(99_102_241/0.2),transparent_70%)]" />
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Logo />
          <div className="order-last w-full sm:order-none sm:ml-6 sm:w-auto">
            <SegmentedControl label="Mode" kind="tab" segments={TABS} value={tab} onChange={setTab} />
          </div>
          <div className="ml-auto">
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div role="tabpanel" id="panel-decide" aria-labelledby="tab-decide" hidden={tab !== "decide"}>
          <DecidePage />
        </div>
        {chatOpened && (
          <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" hidden={tab !== "chat"}>
            <Suspense fallback={<ChatLoading />}>
              <ChatPage />
            </Suspense>
          </div>
        )}
      </main>
    </>
  );
}
