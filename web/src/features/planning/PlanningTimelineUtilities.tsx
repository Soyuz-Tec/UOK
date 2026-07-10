import { Baseline, CalendarClock, ChevronDown, Columns3, Download, FileText, Flag, Lock, Maximize2, Minimize2, SlidersHorizontal, Target, Unlock } from "lucide-react";
import { useEffect, useState } from "react";

import { generateAndDownloadReport } from "../../shared/exporting";
import { SegmentedControl, ToggleButton } from "../../shared/primitives";
import { FieldVisibilityMenu, type ColumnVisibilityMap } from "../../shared/tables";
import { exportPlanningTimelineSvg, planningImportTemplateReportRequest, planningProjectReportRequest, planningScheduleReportRequest } from "./planningExportModel";
import { PlanningFilters } from "./PlanningFilters";
import { PlanningSavedViews } from "./PlanningSavedViews";
import type { TimelineScale } from "./planningGanttModel";
import { maxZoomValue, scaleToZoomValue, timelineScaleOptions, zoomValueToScale } from "./planningScaleOptions";
import type { FieldPreset, PlanningFilterState, PlanningLayoutMode, ViewDensity } from "./planningTimelineModel";
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
  reviewMode,
  reviewModeLocked,
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
  onToggleReviewMode,
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
  token,
  viewDensity,
}: {
  columnOptions: { id: string; label: string }[];
  columnVisibility: ColumnVisibilityMap;
  currentView: PlanningSavedViewConfig;
  fieldPreset: FieldPreset;
  filters: PlanningFilterState;
  focusMode: boolean;
  layoutMode: PlanningLayoutMode;
  reviewMode: boolean;
  reviewModeLocked: boolean;
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
  onToggleReviewMode: () => void;
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
  token: string;
  viewDensity: ViewDensity;
}) {
  const [targetDate, setTargetDate] = useState(projectStart);
  const [reportStatus, setReportStatus] = useState("");
  useEffect(() => setTargetDate(projectStart), [projectStart]);

  return (
    <div className="planning-toolbar-group planning-utilities" aria-label="Timeline utilities">
      <details className="planning-controls-menu">
        <summary aria-label="Open planning controls">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>Planning controls</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="planning-controls-panel">
          <div className="planning-utility-group planning-saved-field-controls" aria-label="Saved views and fields">
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
          </div>
          <div className="planning-utility-group planning-filter-controls" aria-label="Planning filters">
            <PlanningFilters filters={filters} schedule={schedule} onChange={onFiltersChange} />
          </div>
          <div className="planning-utility-group planning-mode-controls" aria-label="Planning mode controls">
            <ToggleButton icon={layoutMode === "timeline" ? Columns3 : Maximize2} className="planning-toolbar-toggle" pressed={layoutMode === "timeline"} onClick={onToggleLayoutMode}>
              {layoutMode === "timeline" ? "Split view" : "Timeline only"}
            </ToggleButton>
            <ToggleButton icon={reviewMode ? Unlock : Lock} className="planning-toolbar-toggle" pressed={reviewMode} onClick={onToggleReviewMode} disabled={reviewModeLocked || schedule.capabilities?.edit !== true}>
              {!reviewModeLocked && schedule.capabilities?.edit === true ? (reviewMode ? "Edit mode" : "Review mode") : "Server review-only"}
            </ToggleButton>
            <ToggleButton icon={focusMode ? Minimize2 : Maximize2} className="planning-toolbar-toggle" pressed={focusMode} onClick={onToggleFocusMode}>
              {focusMode ? "Exit focus" : "Focus"}
            </ToggleButton>
          </div>
          <div className="planning-utility-group planning-scale-controls" aria-label="Timeline scale controls">
            <label className="planning-zoom-control">
              <span>Zoom</span>
              <input type="range" min="0" max={maxZoomValue()} value={scaleToZoomValue(scale)} aria-label="Timeline zoom" onChange={(event) => onScaleChange(zoomValueToScale(event.target.value))} />
            </label>
            <SegmentedControl value={scale} onChange={onScaleChange} options={timelineScaleOptions.map((item) => ({ id: item.value, label: item.label, icon: CalendarClock }))} label="Timeline scale" />
            {scale === "hour" || scale === "minute" ? <span className="planning-muted" role="status">Subday zoom is visual; schedule changes snap to whole project dates.</span> : null}
          </div>
          <div className="planning-utility-group planning-navigation-controls" aria-label="Timeline navigation">
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
          </div>
          <div className="planning-utility-group planning-export-controls" aria-label="Schedule exports">
            <button type="button" className="planning-toolbar-toggle" onClick={() => void runReport("csv", planningScheduleReportRequest(schedule, ["csv"]))}>
              <Download size={16} aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button type="button" className="planning-toolbar-toggle" onClick={() => void runReport("csv", planningImportTemplateReportRequest(schedule, ["csv"]))}>
              <Download size={16} aria-hidden="true" />
              <span>Template</span>
            </button>
            <button type="button" className="planning-toolbar-toggle" onClick={() => void runReport("json", planningProjectReportRequest(schedule, ["json"]))}>
              <Download size={16} aria-hidden="true" />
              <span>Project JSON</span>
            </button>
            <button type="button" className="planning-toolbar-toggle" onClick={() => exportPlanningTimelineSvg(schedule)}>
              <Download size={16} aria-hidden="true" />
              <span>Timeline SVG</span>
            </button>
            <button type="button" className="planning-toolbar-toggle" onClick={() => void runReport("md", planningScheduleReportRequest(schedule, ["md"], `${schedule.project.name} schedule document`))}>
              <FileText size={16} aria-hidden="true" />
              <span>Document</span>
            </button>
          </div>
          <div className="planning-utility-group planning-display-controls" aria-label="Timeline display controls">
            <label className="planning-toolbar-select">
              <ChevronDown size={16} aria-hidden="true" />
              <span>View</span>
              <select value={viewDensity} onChange={(event) => onViewDensityChange(event.target.value as ViewDensity)}>
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="roomy">Roomy</option>
              </select>
            </label>
            <ToggleButton icon={Flag} className="planning-toolbar-toggle" pressed={showCritical} onClick={onToggleCritical}>Critical</ToggleButton>
            <ToggleButton icon={Baseline} className="planning-toolbar-toggle" pressed={showBaselines} onClick={onToggleBaselines}>Baselines</ToggleButton>
          </div>
          <div className="planning-controls-actions">
            {reportStatus ? <span className="planning-muted" aria-live="polite">{reportStatus}</span> : <span />}
            <button type="button" className="planning-toolbar-toggle" onClick={(event) => {
              const menu = event.currentTarget.closest("details");
              if (menu) menu.open = false;
            }}>
              Done
            </button>
          </div>
        </div>
      </details>
    </div>
  );

  async function runReport(format: "csv" | "json" | "md", request: Parameters<typeof generateAndDownloadReport>[1]) {
    setReportStatus("Generating report");
    try {
      const artifact = await generateAndDownloadReport(token, request, format);
      setReportStatus(`Downloaded ${artifact.filename}`);
    } catch {
      setReportStatus("Report export failed");
    }
  }
}
