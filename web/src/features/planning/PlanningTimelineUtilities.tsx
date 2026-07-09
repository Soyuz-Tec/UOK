import { Baseline, CalendarClock, ChevronDown, Columns3, Download, Flag, Maximize2, Minimize2, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { FieldVisibilityMenu, type ColumnVisibilityMap } from "../../shared/tables";
import { PlanningFilters } from "./PlanningFilters";
import { PlanningSavedViews } from "./PlanningSavedViews";
import type { TimelineScale } from "./planningGanttModel";
import { maxZoomValue, scaleToZoomValue, timelineScaleOptions, zoomValueToScale } from "./planningScaleOptions";
import { exportScheduleCsv, type FieldPreset, type PlanningFilterState, type PlanningLayoutMode, type ViewDensity } from "./planningTimelineModel";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import type { PlanningSchedule } from "./types";

export function PlanningTimelineUtilities({
  columnOptions,
  columnVisibility,
  currentView,
  fieldPreset,
  filters,
  focusMode,
  layoutMode,
  onApplySavedView,
  onDateTarget,
  onFieldPresetChange,
  onFitProject,
  onFiltersChange,
  onScaleChange,
  onToggleBaselines,
  onToggleCritical,
  onToggleColumn,
  onToggleFocusMode,
  onToggleLayoutMode,
  onResetColumns,
  onSelectedTask,
  onToday,
  onViewDensityChange,
  projectStart,
  scale,
  schedule,
  selectedTaskId,
  showBaselines,
  showCritical,
  viewDensity,
}: {
  columnOptions: { id: string; label: string }[];
  columnVisibility: ColumnVisibilityMap;
  currentView: PlanningSavedViewConfig;
  fieldPreset: FieldPreset;
  filters: PlanningFilterState;
  focusMode: boolean;
  layoutMode: PlanningLayoutMode;
  onApplySavedView: (config: PlanningSavedViewConfig) => void;
  onDateTarget: (date: string) => void;
  onFieldPresetChange: (preset: FieldPreset) => void;
  onFitProject: () => void;
  onFiltersChange: (filters: PlanningFilterState) => void;
  onScaleChange: (scale: TimelineScale) => void;
  onToggleBaselines: () => void;
  onToggleCritical: () => void;
  onToggleColumn: (columnId: string, visible: boolean) => void;
  onToggleFocusMode: () => void;
  onToggleLayoutMode: () => void;
  onResetColumns: () => void;
  onSelectedTask: () => void;
  onToday: () => void;
  onViewDensityChange: (density: ViewDensity) => void;
  projectStart: string;
  scale: TimelineScale;
  schedule: PlanningSchedule;
  selectedTaskId: string;
  showBaselines: boolean;
  showCritical: boolean;
  viewDensity: ViewDensity;
}) {
  const [targetDate, setTargetDate] = useState(projectStart);
  useEffect(() => setTargetDate(projectStart), [projectStart]);

  return (
    <div className="planning-toolbar-group" aria-label="Timeline utilities">
      <PlanningSavedViews current={currentView} onApply={onApplySavedView} />
      <label className="planning-toolbar-select">
        <Columns3 size={16} aria-hidden="true" />
        <span>Fields</span>
        <select value={fieldPreset} onChange={(event) => onFieldPresetChange(event.target.value as FieldPreset)}>
          <option value="core">Core</option>
          <option value="progress">Progress</option>
          <option value="resources">Resources</option>
        </select>
      </label>
      <FieldVisibilityMenu label="Columns" options={columnOptions} resetLabel="Reset columns" visibility={columnVisibility} onReset={onResetColumns} onToggle={onToggleColumn} />
      <PlanningFilters filters={filters} schedule={schedule} onChange={onFiltersChange} />
      <button type="button" className={`planning-toolbar-toggle ${layoutMode === "timeline" ? "selected" : ""}`} aria-pressed={layoutMode === "timeline"} onClick={onToggleLayoutMode}>
        {layoutMode === "timeline" ? <Columns3 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        <span>{layoutMode === "timeline" ? "Split view" : "Timeline only"}</span>
      </button>
      <label className="planning-zoom-control">
        <span>Zoom</span>
        <input type="range" min="0" max={maxZoomValue()} value={scaleToZoomValue(scale)} aria-label="Timeline zoom" onChange={(event) => onScaleChange(zoomValueToScale(event.target.value))} />
      </label>
      <div className="planning-segmented-control" aria-label="Timeline scale">
        {timelineScaleOptions.map((item) => <button key={item.value} type="button" className={scale === item.value ? "selected" : ""} onClick={() => onScaleChange(item.value)}>{item.label}</button>)}
      </div>
      <label className="planning-toolbar-select">
        <CalendarClock size={16} aria-hidden="true" />
        <span>Date</span>
        <input type="date" aria-label="Timeline target date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      </label>
      <button type="button" className="planning-toolbar-toggle" disabled={!targetDate} onClick={() => onDateTarget(targetDate)}>
        <Target size={16} aria-hidden="true" />
        <span>Go</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" onClick={onToday}>
        <CalendarClock size={16} aria-hidden="true" />
        <span>Today</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" disabled={!selectedTaskId} onClick={onSelectedTask}>
        <Target size={16} aria-hidden="true" />
        <span>Selected</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" onClick={() => {
        onScaleChange("month");
        onFitProject();
      }}>
        <Maximize2 size={16} aria-hidden="true" />
        <span>Fit</span>
      </button>
      <button type="button" className={`planning-toolbar-toggle ${focusMode ? "selected" : ""}`} aria-pressed={focusMode} onClick={onToggleFocusMode}>
        {focusMode ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        <span>{focusMode ? "Exit focus" : "Focus"}</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" onClick={() => exportScheduleCsv(schedule)}>
        <Download size={16} aria-hidden="true" />
        <span>Export</span>
      </button>
      <label className="planning-toolbar-select">
        <ChevronDown size={16} aria-hidden="true" />
        <span>View</span>
        <select value={viewDensity} onChange={(event) => onViewDensityChange(event.target.value as ViewDensity)}>
          <option value="compact">Compact</option>
          <option value="standard">Standard</option>
          <option value="roomy">Roomy</option>
        </select>
      </label>
      <button type="button" className={`planning-toolbar-toggle ${showCritical ? "selected" : ""}`} aria-pressed={showCritical} onClick={onToggleCritical}>
        <Flag size={16} aria-hidden="true" />
        <span>Critical</span>
      </button>
      <button type="button" className={`planning-toolbar-toggle ${showBaselines ? "selected" : ""}`} aria-pressed={showBaselines} onClick={onToggleBaselines}>
        <Baseline size={16} aria-hidden="true" />
        <span>Baselines</span>
      </button>
    </div>
  );
}
