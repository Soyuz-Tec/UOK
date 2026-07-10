import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "../../shared/localization/UokLocalization";
import { ProjectBoundaryMarkers } from "./PlanningGanttShapes";
import type { PlanningProject } from "./types";

afterEach(cleanup);

describe("Planning Gantt project boundary markers", () => {
  it("deduplicates coincident finish markers while preserving every accessible meaning", () => {
    const { container } = render(<svg><ProjectBoundaryMarkers project={project} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg>);

    expect(container.querySelectorAll(".planning-owned-boundary-marker")).toHaveLength(2);
    const finish = screen.getByRole("img", { name: "Compatibility horizon: 2026-08-31; Target finish: 2026-08-31; Calculated finish: 2026-08-31" });
    expect(finish.getAttribute("class")).toContain("end target calculated");
  });

  it("provides localized accessible labels", () => {
    render(<UokLocalizationProvider locale="ar"><svg><ProjectBoundaryMarkers project={project} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg></UokLocalizationProvider>);
    expect(screen.getByRole("img", { name: "أفق التوافق: 2026-08-31; الانتهاء المستهدف: 2026-08-31; الانتهاء المحسوب: 2026-08-31" })).toBeTruthy();
  });

  it("uses the compatibility horizon for absent or invalid legacy finish values without emitting NaN SVG attributes", () => {
    const legacyProject = {
      ...project,
      target_finish: undefined,
      calculated_finish: "not-a-date",
    } as unknown as PlanningProject;

    const { container } = render(<svg><ProjectBoundaryMarkers project={legacyProject} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg>);

    expect(container.innerHTML).not.toContain("NaN");
    expect(container.querySelectorAll(".planning-owned-boundary-marker")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Compatibility horizon: 2026-08-31; Target finish: 2026-08-31; Calculated finish: 2026-08-31" })).toBeTruthy();
  });
});

const project: PlanningProject = {
  id: "project-1",
  name: "Delivery",
  status: "active",
  start: "2026-08-01",
  end: "2026-08-31",
  target_finish: "2026-08-31",
  calculated_finish: "2026-08-31",
  revision: 1,
};
