import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningConcurrencyNotice } from "./PlanningConcurrencyNotice";
import type { PlanningStrongEtag } from "./planningApi";

const detail = {
  code: "stale_precondition",
  message: "The Planning schedule changed after it was loaded.",
  repair: "Review and explicitly reapply or keep the current version.",
  current_revision: 2,
  current_etag: `"planning-r2-sha256-${"b".repeat(64)}"` as PlanningStrongEtag,
  object_ids: ["project-1"],
  reload_url: "/api/planning/projects/project-1/schedule",
};

afterEach(cleanup);

describe("PlanningConcurrencyNotice", () => {
  it("focuses the visible alert and exposes explicit reapply and keep-latest actions", () => {
    const onReapply = vi.fn();
    const onKeepLatest = vi.fn();
    render(
      <PlanningConcurrencyNotice
        recovery={{ detail, label: "Edit task", reloadFailed: false }}
        busy=""
        onReapply={onReapply}
        onKeepLatest={onKeepLatest}
        onReload={() => undefined}
      />,
    );

    const notice = screen.getByRole("alert", { name: "Planning change needs review" });
    expect(notice).toHaveFocus();
    expect(screen.getByText("Revision 2 is loaded. Review it, then reapply edit task or keep the latest version.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reapply change" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep latest" }));
    expect(onReapply).toHaveBeenCalledTimes(1);
    expect(onKeepLatest).toHaveBeenCalledTimes(1);
  });

  it("requires a successful reload before reapply", () => {
    const onReload = vi.fn();
    render(
      <PlanningConcurrencyNotice
        recovery={{ detail, label: "Edit task", reloadFailed: true }}
        busy=""
        onReapply={() => undefined}
        onKeepLatest={() => undefined}
        onReload={onReload}
      />,
    );

    expect(screen.getByRole("button", { name: "Reapply change" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
