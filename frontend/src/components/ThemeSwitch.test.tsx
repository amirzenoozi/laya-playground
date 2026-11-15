import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "./ThemeSwitch";

// A controllable stand-in for the OS's dark mode setting
function mockSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    switchTo: (next: boolean) => {
      dark = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

describe("ThemeSwitch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
  });

  it("follows the system by default, also when it changes", () => {
    const system = mockSystem(false);
    render(<ThemeSwitch />);

    expect(screen.getByRole("radio", { name: "System theme" })).toHaveAttribute("aria-checked", "true");
    expect(isDark()).toBe(false);
    act(() => system.switchTo(true));
    expect(isDark()).toBe(true);
  });

  it("applies and remembers a chosen theme, which no longer follows the system", async () => {
    const system = mockSystem(false);
    const user = userEvent.setup();
    const { unmount } = render(<ThemeSwitch />);

    await user.click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(isDark()).toBe(true);
    act(() => system.switchTo(false));
    expect(isDark()).toBe(true);

    unmount();
    render(<ThemeSwitch />);
    expect(screen.getByRole("radio", { name: "Dark theme" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Light theme" }));
    expect(isDark()).toBe(false);
  });

  it("moves the choice with the arrow keys", async () => {
    mockSystem(false);
    const user = userEvent.setup();
    render(<ThemeSwitch />);

    await user.click(screen.getByRole("radio", { name: "System theme" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Light theme" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Light theme" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Dark theme" })).toHaveAttribute("aria-checked", "true");
  });
});
