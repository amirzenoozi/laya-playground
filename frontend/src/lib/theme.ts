import { useEffect, useState } from "react";
import { loadTheme, saveTheme, type ThemeChoice } from "./storage";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemIsDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && systemIsDark());
  document.documentElement.classList.toggle("dark", dark);
}

// The choice is remembered; "system" also follows the OS when it switches while the page is open.
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(() => loadTheme() ?? "system");

  useEffect(() => {
    applyTheme(choice);
    saveTheme(choice);
    if (choice !== "system" || typeof matchMedia !== "function") return;
    const query = matchMedia(DARK_QUERY);
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  return [choice, setChoice];
}
