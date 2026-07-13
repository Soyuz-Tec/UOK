import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningTimelineUtilities } from "../../web/src/PlanningTimelineUtilities";
import type { PlanningSavedViewConfig } from "../../web/src/planningViewPersistence";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PlanningTimelineUtilities", () => {
  it("uses the shared expandable control panel and restores trigger focus", async () => {
    const onCascadeSchedulingChange = vi.fn();
    const onCascadeSortChange = vi.fn();
    const onCreateBaseline = vi.fn();
    const onLevelResources = vi.fn();
    const onNewMilestone = vi.fn();
    const onOpenDependencies = vi.fn();
    const onOpenResources = vi.fn();
    const onShowInspector = vi.fn();
    const onSelectedVisibleChange = vi.fn();
    const onSetCollapsedSummaries = vi.fn();
    render(<PlanningTimelineUtilities
      busy=""
      bulkUpdatesAvailable
      cascadeScheduling
      cascadeSort
      columnOptions={[{ id: "wbs", label: "WBS" }, { id: "task", label: "Task" }]}
      columnVisibility={{ wbs: true, task: true }}
      currentView={currentView}
      fieldPreset="core"
      focusMode={false}
      layoutMode="split"
      reviewMode={false}
      reviewModeLocked={false}
      reportsOperational={false}
      onApplySavedView={vi.fn()}
      onBulkTaskEdit={vi.fn()}
      onCascadeSchedulingChange={onCascadeSchedulingChange}
      onCascadeSortChange={onCascadeSortChange}
      onCreateBaseline={onCreateBaseline}
      onDateTarget={vi.fn()}
      onFieldPresetChange={vi.fn()}
      onFitProject={vi.fn()}
      onLevelResources={onLevelResources}
      onNewMilestone={onNewMilestone}
      onOpenDependencies={onOpenDependencies}
      onOpenResources={onOpenResources}
      onShowInspector={onShowInspector}
      onScaleChange={vi.fn()}
      onToggleBaselines={vi.fn()}
      onToggleCritical={vi.fn()}
      onToggleColumn={vi.fn()}
      onToggleFocusMode={vi.fn()}
      onToggleLayoutMode={vi.fn()}
      onToggleReviewMode={vi.fn()}
      onResetColumns={vi.fn()}
      onSelectedTask={vi.fn()}
      onSelectedVisibleChange={onSelectedVisibleChange}
      onSetCollapsedSummaries={onSetCollapsedSummaries}
      onToday={vi.fn()}
      onViewDensityChange={vi.fn()}
      projectStart="2026-08-01"
      scale="day"
      schedule={schedule}
      selectedCount={0}
      selectedTaskId=""
      selectedTasks={[]}
      selectedVisible={false}
      showBaselines={false}
      showCritical
      token="token"
      viewDensity="standard"
    />);

    const trigger = screen.getByRole("button", { name: "Open planning controls" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Planning controls" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fields")).toHaveValue("core");
    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
    expect(screen.getByLabelText("View")).toHaveValue("standard");

    const scheduleCommands = screen.getByLabelText("Schedule commands");
    fireEvent.click(within(scheduleCommands).getByRole("checkbox", { name: "0 selected" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Expand" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Collapse" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "WBS order" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Cascade scheduling" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Baseline" }));
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Level" }));

    expect(onSelectedVisibleChange).toHaveBeenCalledWith(true);
    expect(onSetCollapsedSummaries.mock.calls).toEqual([[true], [false]]);
    expect(onCascadeSortChange).toHaveBeenCalledTimes(1);
    expect(onCascadeSchedulingChange).toHaveBeenCalledTimes(1);
    expect(onCreateBaseline).toHaveBeenCalledTimes(1);
    expect(onLevelResources).toHaveBeenCalledWith(260);

    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Show inspector" }));
    await waitFor(() => expect(onShowInspector).toHaveBeenCalledTimes(1));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Milestone" }));
    await waitFor(() => expect(onNewMilestone).toHaveBeenCalledTimes(1));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Link" }));
    await waitFor(() => expect(onOpenDependencies).toHaveBeenCalledTimes(1));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(within(scheduleCommands).getByRole("button", { name: "Resources" }));
    await waitFor(() => expect(onOpenResources).toHaveBeenCalledTimes(1));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });
});

const currentView: PlanningSavedViewConfig = {
  activeView: "Gantt chart",
  cascadeScheduling: true,
  cascadeSort: true,
  fieldPreset: "core",
  filterMode: "all",
  focusMode: false,
  layoutMode: "split",
  query: "",
  partyId: "",
  reviewMode: false,
  resourceId: "",
  scale: "day",
  selectedVisible: false,
  showBaselines: false,
  showCritical: true,
  status: "",
  summaryExpanded: true,
  viewDensity: "standard",
};

const schedule: PlanningSchedule = {
  project: { id: "project-1", name: "Pilot", status: "active", start: "2026-08-01", end: "2026-08-10", target_finish: "2026-08-10", calculated_finish: "2026-08-10", revision: 1 },
  capabilities: { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, analyze: true, analysis_approve: true, review_only: false },
  tasks: [],
  dependencies: [],
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
  resources: [],
  assignments: [],
  links: [],
  baselines: [],
  validation: { ok: true, violations: [] },
};
