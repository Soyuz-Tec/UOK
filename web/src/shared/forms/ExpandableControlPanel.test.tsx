import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpandableControlPanel } from "./ExpandableControlPanel";

describe("ExpandableControlPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("focuses an explicitly preferred control when the panel opens", async () => {
    render(
      <ExpandableControlPanel
        label="Date controls"
        triggerLabel="Open date controls"
        triggerSummary="Date controls"
        initialFocusSelector="[data-preferred='true']"
      >
        <button type="button">First control</button>
        <button type="button" data-preferred="true">Preferred control</button>
      </ExpandableControlPanel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open date controls" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Preferred control" })).toHaveFocus());
  });

  it("wraps compact focus across real tab stops without entering roving items", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <ExpandableControlPanel
        label="Date controls"
        triggerLabel="Open date controls"
        triggerSummary="Date controls"
        defaultOpen
      >
        <button type="button">First control</button>
        <button type="button" tabIndex={-1}>Roving item</button>
        <button type="button">Last control</button>
      </ExpandableControlPanel>,
    );

    const first = screen.getByRole("button", { name: "First control" });
    const roving = screen.getByRole("button", { name: "Roving item" });
    const last = screen.getByRole("button", { name: "Last control" });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    expect(roving).not.toHaveFocus();
  });
});
