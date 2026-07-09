import { describe, expect, it } from "vitest";

import { createPlanningSavedView, planningConfigFromSavedView, type PlanningSavedViewConfig } from "./planningViewPersistence";

const config: PlanningSavedViewConfig = {
  activeView: "Workload",
  cascadeSort: false,
  fieldPreset: "resources",
  filterMode: "critical",
  scale: "week",
  selectedVisible: true,
  showBaselines: true,
  showCritical: true,
  summaryExpanded: false,
  viewDensity: "roomy",
};

describe("planning saved views", () => {
  it("serializes planning view preferences into the shared saved-view shape", () => {
    const view = createPlanningSavedView("  Review board  ", config);
    expect(view.name).toBe("Review board");
    expect(view.filters).toMatchObject({
      activeView: "Workload",
      cascadeSort: "false",
      fieldPreset: "resources",
      filterMode: "critical",
      scale: "week",
      selectedVisible: "true",
      showBaselines: "true",
      showCritical: "true",
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
      cascadeSort: false,
      fieldPreset: "core",
      filterMode: "critical",
      scale: "month",
      selectedVisible: true,
      summaryExpanded: false,
      viewDensity: "roomy",
    });
  });
});
