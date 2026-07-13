import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { WorkspaceActionsMenu } from "./WorkspaceActionsMenu";

afterEach(cleanup);

describe("WorkspaceActionsMenu", () => {
  it("opens a labelled action surface and restores trigger focus after selection", async () => {
    const onExport = vi.fn();
    render(
      <WorkspaceActionsMenu items={[
        { id: "export-report", action: "export", label: "Export report", onSelect: onExport },
        { id: "print-report", action: "print", disabled: true, onSelect: vi.fn() },
      ]} />
    );
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "More actions" });
    const exportButton = within(dialog).getByRole("button", { name: "Export report" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("button", { name: "Print" })).toBeDisabled();
    await waitFor(() => expect(exportButton).toHaveFocus());

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
  });

  it("closes on Escape and restores focus without invoking an action", async () => {
    const onRefresh = vi.fn();
    render(<WorkspaceActionsMenu items={[{ id: "refresh", action: "refresh", onSelect: onRefresh }]} />);
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("localizes its compact trigger and canonical actions", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <WorkspaceActionsMenu items={[{ id: "refresh", action: "refresh", onSelect: vi.fn() }]} />
      </UokLocalizationProvider>
    );

    const trigger = screen.getByRole("button", { name: "مزيد من الإجراءات" });
    expect(trigger).toHaveTextContent("المزيد");
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "تحديث" })).toHaveAttribute("data-command", "refresh");
  });
});
