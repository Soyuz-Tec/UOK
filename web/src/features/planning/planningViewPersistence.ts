import type { SavedSearchView } from "../../shared/forms";
import type { TimelineScale } from "./planningGanttModel";
import { planningViews, type FieldPreset, type FilterMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";

export type PlanningSavedViewConfig = {
  activeView: PlanningView;
  cascadeSort: boolean;
  fieldPreset: FieldPreset;
  filterMode: FilterMode;
  scale: TimelineScale;
  selectedVisible: boolean;
  showBaselines: boolean;
  showCritical: boolean;
  summaryExpanded: boolean;
  viewDensity: ViewDensity;
};

const fieldPresets: FieldPreset[] = ["core", "progress", "resources"];
const filterModes: FilterMode[] = ["all", "critical", "milestones"];
const scales: TimelineScale[] = ["day", "week", "month"];
const viewDensities: ViewDensity[] = ["compact", "standard", "roomy"];

export function createPlanningSavedView(name: string, config: PlanningSavedViewConfig): SavedSearchView {
  return {
    id: `planning-view-${Date.now()}`,
    name: name.trim(),
    query: "",
    filters: {
      activeView: config.activeView,
      cascadeSort: String(config.cascadeSort),
      fieldPreset: config.fieldPreset,
      filterMode: config.filterMode,
      scale: config.scale,
      selectedVisible: String(config.selectedVisible),
      showBaselines: String(config.showBaselines),
      showCritical: String(config.showCritical),
      summaryExpanded: String(config.summaryExpanded),
      viewDensity: config.viewDensity,
    },
    groupBy: config.summaryExpanded ? "expanded" : "collapsed",
    sortBy: config.cascadeSort ? "wbs" : "manual",
    sortDir: "asc",
  };
}

export function planningConfigFromSavedView(view: SavedSearchView, fallback: PlanningSavedViewConfig): PlanningSavedViewConfig {
  return {
    activeView: oneOf(planningViews, view.filters.activeView, fallback.activeView),
    cascadeSort: booleanValue(view.filters.cascadeSort, view.sortBy ? view.sortBy !== "manual" : fallback.cascadeSort),
    fieldPreset: oneOf(fieldPresets, view.filters.fieldPreset, fallback.fieldPreset),
    filterMode: oneOf(filterModes, view.filters.filterMode, fallback.filterMode),
    scale: oneOf(scales, view.filters.scale, fallback.scale),
    selectedVisible: booleanValue(view.filters.selectedVisible, fallback.selectedVisible),
    showBaselines: booleanValue(view.filters.showBaselines, fallback.showBaselines),
    showCritical: booleanValue(view.filters.showCritical, fallback.showCritical),
    summaryExpanded: booleanValue(view.filters.summaryExpanded, view.groupBy ? view.groupBy === "expanded" : fallback.summaryExpanded),
    viewDensity: oneOf(viewDensities, view.filters.viewDensity, fallback.viewDensity),
  };
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined, fallback: T) {
  return values.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}
