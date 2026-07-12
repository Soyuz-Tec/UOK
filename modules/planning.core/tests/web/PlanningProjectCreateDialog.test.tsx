import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { UokLocalizationProvider } from "@uok/shared/localization/UokLocalization";
import { PlanningProjectCreateDialog } from "../../web/src/PlanningProjectCreateDialog";
import type { PlanningProjectCreateRequest } from "../../web/src/planningContracts";

afterEach(() => cleanup());

describe("PlanningProjectCreateDialog", () => {
  it("opens a blank accessible editor and restores focus after Escape", async () => {
    render(<DialogHarness onCreate={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Open create project" });

    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "New project" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("form", { name: "New project form" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toHaveValue("");
    expect(screen.getByLabelText("Start date")).not.toHaveValue("");
    expect(screen.getByLabelText("Target finish")).not.toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Time zone" })).not.toHaveValue("");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New project" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("blocks invalid dates and submits the exact trimmed project contract", async () => {
    const onCreate = vi.fn(async (_payload: PlanningProjectCreateRequest) => undefined);
    render(<DialogHarness onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Open create project" }));

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "  Delivery launch  " } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-08-10" } });
    fireEvent.change(screen.getByLabelText("Target finish"), { target: { value: "2026-08-09" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Time zone" }), { target: { value: "Asia/Kolkata" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Target finish must be on or after the start date.")).toBeVisible();
    expect(screen.getByLabelText("Target finish")).toHaveFocus();
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Target finish"), { target: { value: "2026-08-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      name: "Delivery launch",
      start: "2026-08-10",
      end: "2026-08-31",
      timezone: "Asia/Kolkata",
    }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New project" })).not.toBeInTheDocument());
  });

  it("keeps the editor open and exposes an API failure inside the dialog", async () => {
    const onCreate = vi.fn(async () => { throw new Error("A project with this name already exists."); });
    render(<DialogHarness onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Open create project" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Existing project" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A project with this name already exists.");
    expect(screen.getByRole("dialog", { name: "New project" })).toBeVisible();
  });

  it("cannot be dismissed while a create request is active", () => {
    render(<DialogHarness onCreate={vi.fn()} busy />);
    fireEvent.click(screen.getByRole("button", { name: "Open create project" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "New project" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("localizes the create form and validation in Arabic", async () => {
    render(<UokLocalizationProvider locale="ar"><DialogHarness onCreate={vi.fn()} /></UokLocalizationProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open create project" }));

    expect(screen.getByRole("dialog", { name: "مشروع جديد" })).toBeVisible();
    expect(screen.getByRole("form", { name: "نموذج مشروع جديد" })).toBeVisible();
    expect(screen.getByRole("button", { name: "إنشاء مشروع" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "إنشاء مشروع" }));

    expect(await screen.findByText("أدخل اسم مشروع مكونا من حرفين على الأقل.")).toBeVisible();
    expect(screen.getByLabelText("اسم المشروع")).toHaveFocus();
  });
});

function DialogHarness({ onCreate, busy = false }: { onCreate: (payload: PlanningProjectCreateRequest) => Promise<void>; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open create project</button>
    <PlanningProjectCreateDialog open={open} busy={busy} onClose={() => setOpen(false)} onCreate={onCreate} />
  </>;
}
