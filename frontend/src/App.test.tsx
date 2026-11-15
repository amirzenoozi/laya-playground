import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches between Decide and Chat, and remembers the tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => Promise.resolve(Response.json(url === "/api/models" ? { models: [] } : { model_found: true, loaded: false, keep_alive: 300 }))),
    );
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    expect(screen.getByRole("tab", { name: "Decide" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Decide" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Chat" }));

    expect(screen.getByRole("tabpanel", { name: "Chat" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Decide" })).not.toBeInTheDocument();
    unmount();
    render(<App />);
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  });
});
