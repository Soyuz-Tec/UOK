import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningResourcePanel } from "../../web/src/PlanningResourcePanel";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(cleanup);

describe("Planning typed resources", () => {
  it("submits controlled type, capacity, canonical target, and effective dates", async () => {
    const onCreateResource = vi.fn().mockResolvedValue(undefined);
    render(<PlanningResourcePanel
      schedule={schedule([])}
      selectedTask={null}
      busy=""
      onCreateResource={onCreateResource}
      onAssignResource={vi.fn()}
      onSetResourceCalendar={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Yard vehicle" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "vehicle" } });
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Effective start"), { target: { value: "2026-08-05" } });
    fireEvent.change(screen.getByLabelText("Effective end"), { target: { value: "2026-08-25" } });
    fireEvent.change(screen.getByLabelText("Canonical target type"), { target: { value: "asset" } });
    fireEvent.change(screen.getByLabelText("Canonical target ID"), { target: { value: "asset-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Add resource" }));

    await waitFor(() => expect(onCreateResource).toHaveBeenCalledWith({
      name: "Yard vehicle",
      role: "",
      resource_type: "vehicle",
      capacity_value: 2,
      capacity_unit: "units",
      effective_start: "2026-08-05",
      effective_end: "2026-08-25",
      canonical_target_kind: "asset",
      canonical_target_id: "asset-42",
    }));
  });

  it("submits resource-specific capacity days, holidays, and exceptions", async () => {
    const onSetResourceCalendar = vi.fn().mockResolvedValue(undefined);
    render(<PlanningResourcePanel
      schedule={schedule([resource()])}
      selectedTask={null}
      busy=""
      onCreateResource={vi.fn()}
      onAssignResource={vi.fn()}
      onSetResourceCalendar={onSetResourceCalendar}
    />);
    fireEvent.change(screen.getByLabelText("Assign"), { target: { value: "resource-1" } });
    fireEvent.change(screen.getByLabelText("Working weekdays"), { target: { value: "1,2,3,4,5" } });
    fireEvent.change(screen.getByLabelText("Holidays"), { target: { value: "2026-08-04" } });
    fireEvent.change(screen.getByLabelText("Default capacity %"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Exception start"), { target: { value: "2026-08-06" } });
    fireEvent.change(screen.getByLabelText("Exception end"), { target: { value: "2026-08-07" } });
    fireEvent.change(screen.getByLabelText("Exception capacity %"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Exception reason"), { target: { value: "Extended coverage" } });
    fireEvent.click(screen.getByRole("button", { name: "Save capacity calendar" }));
    await waitFor(() => expect(onSetResourceCalendar).toHaveBeenCalledWith("resource-1", {
      name: "Planner capacity", working_days: [1, 2, 3, 4, 5], holidays: ["2026-08-04"], default_capacity_percent: 50,
      capacity_exceptions: [{ start: "2026-08-06", end: "2026-08-07", capacity_percent: 100, reason: "Extended coverage" }],
    }));
  });
});

function schedule(resources: PlanningSchedule["resources"]): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Resources", status: "active", start: "2026-08-03", end: "2026-08-28", target_finish: "2026-08-28", calculated_finish: "2026-08-28", revision: 1 },
    tasks: [], dependencies: [], resources, assignments: [], links: [], baselines: [],
    validation: { ok: true, violations: [], warnings: [] },
  };
}

function resource() {
  return {
    id: "resource-1", project_id: "project-1", name: "Planner", role: "Scheduling",
    resource_type: "human" as const, capacity_value: 0.5, capacity_unit: "fte" as const,
    canonical_target_kind: null, canonical_target_id: null, canonical_resolution: null,
    effective_start: null, effective_end: null, calendar: null,
  };
}
