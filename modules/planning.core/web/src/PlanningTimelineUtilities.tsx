import { Baseline, CalendarClock, ChevronDown, Columns3, Flag, GitBranch, Link2, Lock, Maximize2, Milestone, Minimize2, Rows3, SlidersHorizontal, Target, Unlock, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { ExpandableControlPanel } from "@uok/shared/forms";
import { CommandButton, SegmentedControl, ToggleButton } from "@uok/shared/primitives";
import { FieldVisibilityMenu, type ColumnVisibilityMap } from "@uok/shared/tables";
import { PlanningBulkEditControls, type PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import { PlanningLevelingControl } from "./PlanningLevelingControl";
import { PlanningReportExportControls } from "./PlanningReportExportControls";
import { PlanningSavedViews } from "./PlanningSavedViews";
import type { TimelineScale } from "./planningGanttModel";
import { maxZoomValue, scaleToZoomValue, timelineScaleOptions, zoomValueToScale } from "./planningScaleOptions";
import type { FieldPreset, PlanningLayoutMode, ViewDensity } from "./planningTimelineModel";
import type { PlanningSavedViewConfig } from "./planningViewPersistence";
import type { PlanningSchedule } from "./types";

export function PlanningTimelineUtilities({
  columnOptions,
  columnVisibility,
  currentView,
  busy,
  bulkUpdatesAvailable,
  cascadeScheduling,
  cascadeSort,
  fieldPreset,
  focusMode,
  layoutMode,
  reviewMode,
  reviewModeLocked,
  reportsOperational,
  onApplySavedView,
  onBulkTaskEdit,
  onCascadeSchedulingChange,
  onCascadeSortChange,
  onCreateBaseline,
  onDateTarget,
  onFieldPresetChange,
  onFitProject,
  onLevelResources,
  onNewMilestone,
  onOpenDependencies,
  onOpenResources,
  onScaleChange,
  onToggleBaselines,
  onToggleCritical,
  onToggleColumn,
  onToggleFocusMode,
  onToggleLayoutMode,
  onToggleReviewMode,
  onResetColumns,
  onSelectedTask,
  onSelectedVisibleChange,
  onSetCollapsedSummaries,
  onToday,
  onViewDensityChange,
  projectStart,
  scale,
  schedule,
  selectedCount,
  selectedTaskId,
  selectedTasks,
  selectedVisible,
  showBaselines,
  showCritical,
  token,
  viewDensity,
}: {
  columnOptions: { id: string; label: string }[];
  columnVisibility: ColumnVisibilityMap;
  currentView: PlanningSavedViewConfig;
  fieldPreset: FieldPreset;
  focusMode: boolean;
  layoutMode: PlanningLayoutMode;
  reviewMode: boolean;
  reviewModeLocked: boolean;
  reportsOperational: boolean;
  busy: string;
  bulkUpdatesAvailable: boolean;
  cascadeScheduling: boolean;
  cascadeSort: boolean;
  onApplySavedView: (config: PlanningSavedViewConfig) => void;
  onBulkTaskEdit: (updates: PlanningBulkTaskUpdate[]) => void;
  onCascadeSchedulingChange: () => void;
  onCascadeSortChange: () => void;
  onCreateBaseline: () => void;
  onDateTarget: (date: string) => void;
  onFieldPresetChange: (preset: FieldPreset) => void;
  onFitProject: () => void;
  onLevelResources: (horizonDays: number) => void;
  onNewMilestone: () => void;
  onOpenDependencies: () => void;
  onOpenResources: () => void;
  onScaleChange: (scale: TimelineScale) => void;
  onToggleBaselines: () => void;
  onToggleCritical: () => void;
  onToggleColumn: (columnId: string, visible: boolean) => void;
  onToggleFocusMode: () => void;
  onToggleLayoutMode: () => void;
  onToggleReviewMode: () => void;
  onResetColumns: () => void;
  onSelectedTask: () => void;
  onSelectedVisibleChange: (selected: boolean) => void;
  onSetCollapsedSummaries: (expanded: boolean) => void;
  onToday: () => void;
  onViewDensityChange: (density: ViewDensity) => void;
  projectStart: string;
  scale: TimelineScale;
  schedule: PlanningSchedule;
  selectedTaskId: string;
  selectedCount: number;
  selectedTasks: PlanningSchedule["tasks"];
  selectedVisible: boolean;
  showBaselines: boolean;
  showCritical: boolean;
  token: string;
  viewDensity: ViewDensity;
}) {
  const [targetDate, setTargetDate] = useState(projectStart);
  useEffect(() => setTargetDate(projectStart), [projectStart]);

  return (
    <div className="planning-toolbar-group planning-utilities" aria-label="Timeline utilities">
      <ExpandableControlPanel
        className="planning-controls-menu"
        label="Planning controls"
        panelClassName="planning-controls-panel"
        triggerIcon={SlidersHorizontal}
        triggerLabel="Open planning controls"
        triggerSummary="Planning controls"
      >
        {({ close }) => {
          const openInspector = (action: () => void) => {
            close();
            queueMicrotask(action);
          };
          return <>
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
          <div className="planning-utility-group planning-schedule-controls" aria-label="Schedule commands">
            <label className="planning-selection-toggle">
              <input type="checkbox" checked={selectedVisible} onChange={(event) => onSelectedVisibleChange(event.target.checked)} />
              <span>{selectedCount} selected</span>
            </label>
            {selectedVisible ? <PlanningBulkEditControls busy={busy === "bulk-task"} disabled={reviewMode || !bulkUpdatesAvailable} selectedTasks={selectedTasks} onBulkTaskEdit={onBulkTaskEdit} /> : null}
            <CommandButton icon={Milestone} onClick={() => openInspector(onNewMilestone)} disabled={reviewMode}>Milestone</CommandButton>
            <CommandButton icon={Link2} onClick={() => openInspector(onOpenDependencies)} disabled={reviewMode}>Link</CommandButton>
            <ToggleButton icon={Maximize2} className="planning-toolbar-toggle" onClick={() => onSetCollapsedSummaries(true)}>Expand</ToggleButton>
            <ToggleButton icon={Minimize2} className="planning-toolbar-toggle" onClick={() => onSetCollapsedSummaries(false)}>Collapse</ToggleButton>
            <ToggleButton icon={Rows3} className="planning-toolbar-toggle" aria-label="WBS order" pressed={cascadeSort} onClick={onCascadeSortChange}>WBS</ToggleButton>
            <ToggleButton icon={GitBranch} className="planning-toolbar-toggle" aria-label="Cascade scheduling" pressed={cascadeScheduling} onClick={onCascadeSchedulingChange} disabled={reviewMode}>Cascade</ToggleButton>
            <CommandButton icon={Baseline} onClick={onCreateBaseline} disabled={reviewMode || schedule.capabilities?.baseline_create !== true}>Baseline</CommandButton>
            <CommandButton icon={Users} onClick={() => openInspector(onOpenResources)} disabled={reviewMode}>Resources</CommandButton>
            <PlanningLevelingControl busy={busy === "level"} disabled={reviewMode || schedule.capabilities?.level !== true} onLevel={onLevelResources} />
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
          <PlanningReportExportControls reportsOperational={reportsOperational} schedule={schedule} token={token} />
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
            <span />
            <button type="button" className="planning-toolbar-toggle" onClick={close}>
              Done
            </button>
          </div>
        </>;
        }}
      </ExpandableControlPanel>
    </div>
  );
}
