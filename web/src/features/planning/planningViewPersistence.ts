import type { SavedSearchView } from "../../shared/forms";
import { timelineScales, type TimelineScale } from "./planningGanttModel";
import { planningViews, type FieldPreset, type FilterMode, type PlanningView, type ViewDensity } from "./planningTimelineModel";

export type PlanningSavedViewConfig = {
  activeView: PlanningView;
  cascadeSort: boolean;
  fieldPreset: FieldPreset;
  filterMode: FilterMode;
  query: string;
  resourceId: string;
  scale: TimelineScale;
  selectedVisible: boolean;
  showBaselines: boolean;
  showCritical: boolean;
  status: string;
  summaryExpanded: boolean;
  viewDensity: ViewDensity;
};

const fieldPresets: FieldPreset[] = ["core", "progress", "resources"];
const filterModes: FilterMode[] = ["all", "critical", "milestones"];
const scales: readonly TimelineScale[] = timelineScales;
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
      query: config.query,
      resourceId: config.resourceId,
      scale: config.scale,
      selectedVisible: String(config.selectedVisible),
      showBaselines: String(config.showBaselines),
      showCritical: String(config.showCritical),
      status: config.status,
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
    query: stringValue(view.filters.query, fallback.query),
    resourceId: stringValue(view.filters.resourceId, fallback.resourceId),
    scale: oneOf(scales, view.filters.scale, fallback.scale),
    selectedVisible: booleanValue(view.filters.selectedVisible, fallback.selectedVisible),
    showBaselines: booleanValue(view.filters.showBaselines, fallback.showBaselines),
    showCritical: booleanValue(view.filters.showCritical, fallback.showCritical),
    status: stringValue(view.filters.status, fallback.status),
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

function stringValue(value: string | undefined, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
