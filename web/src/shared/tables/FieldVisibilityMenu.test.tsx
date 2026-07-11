import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpandableControlPanel } from "../forms";
import { FieldVisibilityMenu } from "./FieldVisibilityMenu";

afterEach(cleanup);

describe("FieldVisibilityMenu", () => {
  it("uses the shared bounded panel and restores trigger focus on Escape", async () => {
    render(<FieldVisibilityMenu
      options={[{ id: "name", label: "Name" }, { id: "status", label: "Status" }]}
      visibility={{ name: true, status: false }}
      onReset={vi.fn()}
      onToggle={vi.fn()}
    />);

    const trigger = screen.getByRole("button", { name: "Fields" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Visible fields" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Name" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  it("dismisses on an outside pointer interaction", async () => {
    render(<div>
      <FieldVisibilityMenu options={[{ id: "name", label: "Name" }]} visibility={{ name: true }} onReset={vi.fn()} onToggle={vi.fn()} />
      <button type="button">Outside</button>
    </div>);

    const trigger = screen.getByRole("button", { name: "Fields" });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("dismisses only the innermost panel on Escape", async () => {
    render(<ExpandableControlPanel label="Outer controls" triggerLabel="Open outer controls" triggerSummary="Outer controls">
      <FieldVisibilityMenu options={[{ id: "name", label: "Name" }]} visibility={{ name: true }} onReset={vi.fn()} onToggle={vi.fn()} />
    </ExpandableControlPanel>);

    const outerTrigger = screen.getByRole("button", { name: "Open outer controls" });
    fireEvent.click(outerTrigger);
    const fieldsTrigger = screen.getByRole("button", { name: "Fields" });
    fireEvent.click(fieldsTrigger);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Name" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(fieldsTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(outerTrigger).toHaveAttribute("aria-expanded", "true");
    expect(fieldsTrigger).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(outerTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(outerTrigger).toHaveFocus();
  });
});
