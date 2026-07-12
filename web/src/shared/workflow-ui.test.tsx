import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { InlineTextEdit } from "./forms";
import { SectionHeading } from "./layout";
import { WorkspaceContextMenu, WorkspaceEditorPopup, WorkspacePopup } from "./overlays";

describe("InlineTextEdit", () => {
  it("validates locally and keeps the editor open when save fails", async () => {
    const commit = vi.fn().mockRejectedValue(new Error("failed"));
    render(
      <InlineTextEdit
        label="Display name"
        value="Current name"
        validate={(value) => value ? "" : "Display name cannot be blank."}
        onCommit={commit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));
    const field = screen.getByLabelText("Display name");
    fireEvent.change(field, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Display name cannot be blank.")).toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "Next name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(commit).toHaveBeenCalledWith("Next name"));
    expect(await screen.findByText("Could not save. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
  });
});

describe("SectionHeading", () => {
  it("renders reusable compact section heading copy and action", () => {
    render(
      <SectionHeading
        eyebrow="Groups"
        title="Contact groups"
        action={<span aria-label="Group icon">Icon</span>}
      />
    );

    expect(screen.getByText("Groups")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { name: "Contact groups" })).toBeInTheDocument();
    expect(screen.getByLabelText("Group icon")).toBeInTheDocument();
  });
});

describe("WorkspacePopup", () => {
  it("renders a reusable dialog and closes from the keyboard", () => {
    const close = vi.fn();
    render(
      <WorkspacePopup open label="Record editor" onClose={close}>
        <p>Editable record content</p>
      </WorkspacePopup>
    );

    expect(screen.getByRole("dialog", { name: "Record editor" })).toHaveTextContent("Editable record content");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("prevents every dismissal path while the dialog is not dismissible", () => {
    const close = vi.fn();
    render(
      <WorkspacePopup open label="Busy editor" onClose={close} dismissible={false}>
        <button type="button">Continue editing</button>
      </WorkspacePopup>
    );

    expect(screen.getByRole("button", { name: "Close Busy editor" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog", { name: "Busy editor" }).parentElement!);

    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue editing" })).toHaveFocus();
  });

  it("contains keyboard focus, isolates the background, and restores both exactly", () => {
    const close = vi.fn();
    const closed = (
      <div>
        <button type="button" data-testid="popup-launcher" aria-hidden="false">Open editor</button>
        <WorkspacePopup open={false} label="Focus editor" onClose={close}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </WorkspacePopup>
      </div>
    );
    const opened = (
      <div>
        <button type="button" data-testid="popup-launcher" aria-hidden="false">Open editor</button>
        <WorkspacePopup open label="Focus editor" onClose={close}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </WorkspacePopup>
      </div>
    );
    const { rerender } = render(closed);
    const launcher = screen.getByTestId("popup-launcher");
    launcher.focus();

    rerender(opened);

    const closeButton = screen.getByRole("button", { name: "Close Focus editor" });
    const lastAction = screen.getByRole("button", { name: "Last action" });
    expect(closeButton).toHaveFocus();
    expect(launcher).toHaveAttribute("aria-hidden", "true");
    expect(launcher).toHaveAttribute("inert");

    lastAction.focus();
    fireEvent.keyDown(lastAction, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(lastAction).toHaveFocus();

    rerender(closed);
    expect(launcher).toHaveAttribute("aria-hidden", "false");
    expect(launcher).not.toHaveAttribute("inert");
    expect(launcher).toHaveFocus();
  });

  it("stays out of the DOM when closed", () => {
    render(
      <WorkspacePopup open={false} label="Hidden editor" onClose={vi.fn()}>
        <p>Hidden content</p>
      </WorkspacePopup>
    );

    expect(screen.queryByRole("dialog", { name: "Hidden editor" })).not.toBeInTheDocument();
  });
});

describe("WorkspaceContextMenu", () => {
  it("renders reusable menu actions and closes from Escape", () => {
    const close = vi.fn();
    const select = vi.fn();
    render(
      <WorkspaceContextMenu
        open
        label="Record actions"
        position={{ x: 24, y: 32 }}
        onClose={close}
        items={[{ id: "duplicate", label: "Duplicate", description: "Copy record", onSelect: select }]}
      />
    );

    const menu = screen.getByRole("menu", { name: "Record actions" });
    expect(menu).toHaveTextContent("Copy record");
    fireEvent.click(screen.getByRole("menuitem", { name: /Duplicate/ }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("WorkspaceEditorPopup", () => {
  it("adds a reusable editor header inside the popup", () => {
    render(
      <WorkspaceEditorPopup open label="Record workspace" title="Record editor" description="Edit without leaving the workspace." onClose={vi.fn()}>
        <p>Editor body</p>
      </WorkspaceEditorPopup>
    );

    const dialog = screen.getByRole("dialog", { name: "Record workspace" });
    expect(dialog).toHaveTextContent("Record editor");
    expect(dialog).toHaveTextContent("Edit without leaving the workspace.");
    expect(dialog).toHaveTextContent("Editor body");
  });
});
