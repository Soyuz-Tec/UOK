import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { ConfirmCommandButton } from "./ConfirmCommandButton";
import { WorkspaceActionButton, type WorkspaceActionKind } from "./WorkspaceActionButton";

afterEach(cleanup);

const actions: Array<{ action: WorkspaceActionKind; label: string }> = [
  { action: "open", label: "Open" },
  { action: "close", label: "Close" },
  { action: "create", label: "Create" },
  { action: "delete", label: "Delete" },
  { action: "edit", label: "Edit" },
  { action: "save", label: "Save" },
  { action: "cancel", label: "Cancel" },
  { action: "search", label: "Search" },
  { action: "export", label: "Export" },
  { action: "print", label: "Print" },
  { action: "refresh", label: "Refresh" },
];

describe("WorkspaceActionButton", () => {
  it.each(actions)("renders the canonical $action action", ({ action, label }) => {
    render(<WorkspaceActionButton action={action} />);

    const button = screen.getByRole("button", { name: label });
    expect(button).toHaveAttribute("data-command", action);
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses contextual visible copy while preserving action semantics", () => {
    render(
      <WorkspaceActionButton
        action="open"
        aria-label="Open project North Star"
        aria-keyshortcuts="Enter"
        title="Open North Star"
      >
        Open
      </WorkspaceActionButton>
    );

    const button = screen.getByRole("button", { name: "Open project North Star" });
    expect(button).toHaveTextContent("Open");
    expect(button).toHaveAttribute("data-command", "open");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Enter");
    expect(button).toHaveAttribute("title", "Open North Star");
  });

  it("defaults delete to destructive and composes shared button state", () => {
    render(<WorkspaceActionButton action="delete" className="record-delete" loading loadingLabel="Deleting record" />);

    const button = screen.getByRole("button", { name: "Deleting record" });
    expect(button).toHaveClass("command-button", "workspace-action-button", "record-delete", "destructive", "loading");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("localizes canonical labels and generic working state", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <WorkspaceActionButton action="save" loading />
      </UokLocalizationProvider>
    );

    expect(screen.getByRole("button", { name: "جارٍ العمل" })).toHaveAttribute("data-command", "save");
  });

  it("localizes contextual labels without losing canonical action semantics", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <WorkspaceActionButton action="create" labelKey="command.newEvent" fallbackLabel="New event" />
      </UokLocalizationProvider>
    );

    expect(screen.getByRole("button", { name: "حدث جديد" })).toHaveAttribute("data-command", "create");
  });
});

describe("ConfirmCommandButton", () => {
  it("uses the shared draggable popup and requires a reason before confirming", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmCommandButton
        icon={Trash2}
        message="The record will leave active use but remain recoverable."
        dialogLabel="Delete record"
        title="Delete record"
        confirmLabel="Delete"
        reasonLabel="Reason"
        reasonRequired
        onConfirm={confirm}
        destructive
      >
        Delete record
      </ConfirmCommandButton>
    );

    const trigger = screen.getByRole("button", { name: "Delete record" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Delete record" });
    expect(screen.getByRole("button", { name: "Move Delete record" })).toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Duplicate workspace" } });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Duplicate workspace"));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("keeps the popup open and reports an asynchronous failure", async () => {
    render(
      <ConfirmCommandButton
        icon={Trash2}
        message="Delete this record?"
        dialogLabel="Delete record"
        title="Delete record"
        confirmLabel="Delete"
        onConfirm={() => Promise.reject(new Error("Record is protected."))}
        destructive
      >
        Delete record
      </ConfirmCommandButton>
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete record" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Record is protected.");
    expect(screen.getByRole("dialog", { name: "Delete record" })).toBeInTheDocument();
  });
});
