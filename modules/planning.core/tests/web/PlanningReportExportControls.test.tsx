import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { PlanningReportExportControls } from "../../web/src/PlanningReportExportControls";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(cleanup);

describe("PlanningReportExportControls", () => {
  it("fails closed for server reports while preserving the local SVG export", () => {
    render(
      <PlanningReportExportControls
        reportsOperational={false}
        schedule={schedule()}
        token="token"
      />,
    );

    for (const label of ["Export CSV", "Template", "Project JSON", "Document"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Timeline SVG" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reports unavailable; report artifacts are disabled while Planning remains operational.",
    );
  });

  it("enables server report exports when Reports is operational", () => {
    render(
      <PlanningReportExportControls
        reportsOperational
        schedule={schedule()}
        token="token"
      />,
    );

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});


function schedule(): PlanningSchedule {
  return {
    project: {
      id: "project-1",
      name: "Pilot Delivery",
      status: "active",
      start: "2026-08-01",
      end: "2026-08-10",
      target_finish: "2026-08-10",
      calculated_finish: "2026-08-10",
      revision: 1,
    },
    tasks: [],
    dependencies: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    validation: { ok: true, violations: [] },
  };
}
