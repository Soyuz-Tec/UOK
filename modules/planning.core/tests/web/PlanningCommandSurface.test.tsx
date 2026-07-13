import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { PlanningCommandSurface } from "../../web/src/PlanningCommandSurface";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(cleanup);

describe("PlanningCommandSurface", () => {
  it("keeps the frequent compact controls reachable without a permanent view tab row", () => {
    const onActiveViewChange = vi.fn();
    render(<PlanningCommandSurface model={model} actions={{ ...actions, onActiveViewChange }} />);

    expect(screen.getByRole("textbox", { name: "Search planning tasks" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project")).toHaveValue("project-1");
    expect(screen.getByRole("button", { name: "Open schedule health: Partial evidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open planning controls" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New task" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Planning views" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Planning view"), { target: { value: "Workload" } });
    expect(onActiveViewChange).toHaveBeenCalledWith("Workload");
  });

  it("renders every Planning view and the Logic preset in Arabic without changing persisted values", () => {
    const onActiveViewChange = vi.fn();
    render(
      <UokLocalizationProvider locale="ar">
        <PlanningCommandSurface model={model} actions={{ ...actions, onActiveViewChange }} />
      </UokLocalizationProvider>,
    );

    const view = screen.getByRole("combobox", { name: "عرض التخطيط" });
    expect(view).toHaveValue("Gantt chart");
    expect(within(view).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "مخطط جانت", "اللوحة", "القائمة", "التقويم", "عبء العمل", "الأشخاص", "لوحة المعلومات",
    ]);

    fireEvent.change(view, { target: { value: "Workload" } });
    expect(onActiveViewChange).toHaveBeenCalledWith("Workload");

    fireEvent.click(screen.getByRole("button", { name: "Open planning controls" }));
    expect(screen.getByRole("option", { name: "منطق الجدولة" })).toHaveValue("logic");
  });
});

const schedule: PlanningSchedule = {
  project: { id: "project-1", name: "Pilot", status: "active", start: "2026-08-01", end: "2026-08-10", target_finish: "2026-08-10", calculated_finish: "2026-08-10", revision: 1 },
  capabilities: { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, analyze: true, analysis_approve: true, review_only: false },
  tasks: [], dependencies: [], resources: [], assignments: [], links: [], baselines: [], validation: { ok: true, violations: [] },
};

const model = {
  projects: [schedule.project], schedule, visibleSchedule: schedule, selectedProjectId: "project-1", busy: "",
  history: { canUndo: false, canRedo: false, undoLabel: "", redoLabel: "" }, bulkUpdatesAvailable: true, canCreateProject: true,
  activeView: "Gantt chart" as const, cascadeScheduling: true, cascadeSort: true,
  columnOptions: [{ id: "wbs", label: "WBS" }, { id: "task", label: "Task" }], columnVisibility: { wbs: true, task: true },
  currentView: { activeView: "Gantt chart" as const, cascadeScheduling: true, cascadeSort: true, fieldPreset: "core" as const, filterMode: "all" as const, focusMode: false, layoutMode: "split" as const, query: "", partyId: "", reviewMode: false, resourceId: "", scale: "day" as const, selectedVisible: false, showBaselines: false, showCritical: true, splitPercent: 42, status: "", summaryExpanded: true, viewDensity: "standard" as const },
  fieldPreset: "core" as const, filters: { mode: "all" as const, query: "", partyId: "", resourceId: "", status: "" }, focusMode: false,
  layoutMode: "split" as const, reviewMode: false, reviewModeLocked: false, reportsOperational: false, scale: "day" as const,
  selectedCount: 0, selectedTaskId: "", selectedTasks: [], selectedVisible: false, showBaselines: false, showCritical: true, token: "token", viewDensity: "standard" as const,
};

const actions = {
  onActiveViewChange: vi.fn(), onApplySavedView: vi.fn(), onBulkTaskEdit: vi.fn(), onCascadeSchedulingChange: vi.fn(), onCascadeSortChange: vi.fn(),
  onCreateBaseline: vi.fn(), onCreateDemoSchedule: vi.fn(), onDateTarget: vi.fn(), onFieldPresetChange: vi.fn(), onFiltersChange: vi.fn(),
  onFitProject: vi.fn(), onLevelResources: vi.fn(), onNewTask: vi.fn(), onOpenDependencies: vi.fn(), onShowInspector: vi.fn(), onOpenResources: vi.fn(),
  onProjectChange: vi.fn(), onNewProject: vi.fn(), onRedo: vi.fn(), onRefresh: vi.fn(), onReviewModeChange: vi.fn(), onScaleChange: vi.fn(),
  onSelectedTask: vi.fn(), onSelectedVisibleChange: vi.fn(), onSetCollapsedSummaries: vi.fn(), onToday: vi.fn(), onToggleBaselines: vi.fn(),
  onToggleColumn: vi.fn(), onToggleCritical: vi.fn(), onToggleFocusMode: vi.fn(), onToggleLayoutMode: vi.fn(), onToggleReviewMode: vi.fn(),
  onResetColumns: vi.fn(), onUndo: vi.fn(), onViewDensityChange: vi.fn(),
};
