import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { InlineTextEdit } from "./forms";
import { WorkspaceEditorPopup, WorkspacePopup } from "./overlays";

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

  it("stays out of the DOM when closed", () => {
    render(
      <WorkspacePopup open={false} label="Hidden editor" onClose={vi.fn()}>
        <p>Hidden content</p>
      </WorkspacePopup>
    );

    expect(screen.queryByRole("dialog", { name: "Hidden editor" })).not.toBeInTheDocument();
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
