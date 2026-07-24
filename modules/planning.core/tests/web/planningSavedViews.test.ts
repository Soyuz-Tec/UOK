import { describe, expect, it } from "vitest";

import { createPlanningSavedView, planningConfigFromSavedView, type PlanningSavedViewConfig } from "../../web/src/planningViewPersistence";

const config: PlanningSavedViewConfig = {
  activeView: "Workload",
  cascadeScheduling: false,
  cascadeSort: false,
  fieldPreset: "logic",
  filterMode: "critical",
  focusMode: true,
  layoutMode: "timeline",
  query: "pump",
  partyId: "party-1",
  reviewMode: true,
  resourceId: "resource-1",
  scale: "week",
  selectedVisible: true,
  showBaselines: true,
  showCritical: true,
  splitPercent: 47,
  status: "blocked",
  summaryExpanded: false,
  viewDensity: "roomy",
};

describe("planning saved views", () => {
  it("serializes planning view preferences into the shared saved-view shape", () => {
    const view = createPlanningSavedView("  Review board  ", config);
    expect(view.name).toBe("Review board");
    expect(view.filters).toMatchObject({
      activeView: "Workload",
      cascadeScheduling: "false",
      cascadeSort: "false",
      fieldPreset: "logic",
      filterMode: "critical",
      focusMode: "true",
      layoutMode: "timeline",
      query: "pump",
      partyId: "party-1",
      reviewMode: "true",
      resourceId: "resource-1",
      scale: "week",
      selectedVisible: "true",
      showBaselines: "true",
      showCritical: "true",
      splitPercent: "47",
      status: "blocked",
      summaryExpanded: "false",
      viewDensity: "roomy",
    });
    expect(view.groupBy).toBe("collapsed");
    expect(view.sortBy).toBe("manual");
  });

  it("restores valid saved values and keeps fallback values for invalid data", () => {
    const view = createPlanningSavedView("Saved", config);
    view.filters.scale = "invalid";
    view.filters.fieldPreset = "invalid";
    const restored = planningConfigFromSavedView(view, { ...config, fieldPreset: "core", scale: "month" });
    expect(restored).toMatchObject({
      activeView: "Workload",
      cascadeScheduling: false,
      cascadeSort: false,
      fieldPreset: "core",
      filterMode: "critical",
      focusMode: true,
      layoutMode: "timeline",
      query: "pump",
      partyId: "party-1",
      reviewMode: true,
      resourceId: "resource-1",
      scale: "month",
      selectedVisible: true,
      splitPercent: 47,
      status: "blocked",
      summaryExpanded: false,
      viewDensity: "roomy",
    });
  });

  it("clamps restored split positions and preserves legacy fallback values", () => {
    const view = createPlanningSavedView("Saved", config);
    view.filters.splitPercent = "200";
    expect(planningConfigFromSavedView(view, config).splitPercent).toBe(68);
    delete view.filters.splitPercent;
    expect(planningConfigFromSavedView(view, { ...config, splitPercent: 39 }).splitPercent).toBe(39);
  });
});
