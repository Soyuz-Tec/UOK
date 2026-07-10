import type { KeyboardEvent, RefObject, UIEvent } from "react";

import type { ColumnWidthMap } from "../../shared/tables";
import type { PlanningDependencyChain } from "./planningDependencyChain";
import { taskDependencyChainClass } from "./planningDependencyChain";
import type { PlanningGridColumn } from "./planningGanttModel";
import { PlanningGanttEmptyState } from "./PlanningGanttEmptyState";
import { PlanningGanttGridHeader } from "./PlanningGanttGridHeader";
import { PlanningGanttGridRow } from "./PlanningGanttGridRow";
import type { PlanningGridSort } from "./planningGridSortModel";
import type { PinnedColumnOffsetMap } from "./planningPinnedColumns";
import type { PlanningRowLayout } from "./planningRowHeights";
import type { PlanningTaskUpdateRequest } from "./planningContracts";
import type { PlanningTask } from "./types";

export type PlanningGanttGridState = {
  allTasks: PlanningTask[];
  assignedByTask: Map<string, string>;
  columns: PlanningGridColumn[];
  dependencyChain: PlanningDependencyChain;
  gridTemplateColumns: string;
  pinnedOffsets: PinnedColumnOffsetMap;
  readOnly: boolean;
  renderedTasks: PlanningTask[];
  rowLayoutByTask: Map<string, PlanningRowLayout>;
  rowSize: number;
  selectedTaskId: string;
  showCritical: boolean;
  sort: PlanningGridSort;
  summaryExpanded: (task: PlanningTask) => boolean;
  totalHeight: number;
  totalWidth: number;
  virtualized: boolean;
  widths: ColumnWidthMap;
};

export type PlanningGanttGridActions = {
  onColumnMoveBefore: (sourceId: string, targetId: string) => void;
  onColumnVisible: (columnId: string, visible: boolean) => void;
  onColumnsReset: () => void;
  onColumnWidthChange: (columnId: string, width: number) => void;
  onHeaderDoubleClick: (column: PlanningGridColumn) => void;
  onKeyDown: (task: PlanningTask, event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenTaskMenu: (taskId: string, x: number, y: number, event: { preventDefault: () => void; stopPropagation: () => void }) => void;
  onResetColumnWidth: (columnId: string) => void;
  onRowHeightChange: (taskId: string, height: number) => void;
  onRowHeightReset: (taskId: string) => void;
  onRowRef: (taskId: string, element: HTMLDivElement | null) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onSelect: (taskId: string) => void;
  onSort: (columnId: string) => void;
  onSummaryToggle: (taskId: string) => void;
  onTaskInlineEdit: (taskId: string, payload: PlanningTaskUpdateRequest) => void;
};

export function PlanningGanttGrid({ actions, bodyRef, state }: {
  actions: PlanningGanttGridActions;
  bodyRef: RefObject<HTMLDivElement | null>;
  state: PlanningGanttGridState;
}) {
  const taskIndexes = new Map(state.allTasks.map((task, index) => [task.id, index]));
  return (
    <div className="planning-owned-grid" role="table" aria-label="Planning task grid" aria-rowcount={state.allTasks.length + 1}>
      <PlanningGanttGridHeader
        assignedByTask={state.assignedByTask} columns={state.columns} gridTemplateColumns={state.gridTemplateColumns}
        totalWidth={state.totalWidth} widths={state.widths} pinnedOffsets={state.pinnedOffsets} tasks={state.allTasks}
        onColumnMoveBefore={actions.onColumnMoveBefore} onColumnVisible={actions.onColumnVisible} onColumnsReset={actions.onColumnsReset}
        onColumnWidthChange={actions.onColumnWidthChange} onHeaderDoubleClick={actions.onHeaderDoubleClick}
        onResetColumnWidth={actions.onResetColumnWidth} onSort={actions.onSort} sort={state.sort}
      />
      <div className="planning-owned-grid-body" ref={bodyRef} role="rowgroup" onScroll={actions.onScroll}>
        <div className="planning-owned-grid-body-content" style={state.virtualized ? { height: state.totalHeight } : undefined}>
          {state.renderedTasks.map((task) => {
            const layout = state.rowLayoutByTask.get(task.id);
            return (
              <PlanningGanttGridRow
                key={task.id} assignedByTask={state.assignedByTask} chainClass={taskDependencyChainClass(state.dependencyChain, task.id)}
                columns={state.columns} gridTemplateColumns={state.gridTemplateColumns} isSelected={task.id === state.selectedTaskId}
                minWidth={state.totalWidth} pinnedOffsets={state.pinnedOffsets} readOnly={state.readOnly}
                rowHeight={layout?.height || state.rowSize} rowIndex={(taskIndexes.get(task.id) || 0) + 2}
                rowRef={(element) => actions.onRowRef(task.id, element)} rowSize={state.rowSize}
                showCritical={state.showCritical} summaryExpanded={state.summaryExpanded(task)} task={task}
                virtualTop={state.virtualized ? layout?.top : undefined}
                onKeyDown={actions.onKeyDown} onOpenTaskMenu={actions.onOpenTaskMenu} onSelect={actions.onSelect}
                onSummaryToggle={() => actions.onSummaryToggle(task.id)} onTaskInlineEdit={actions.onTaskInlineEdit}
                onRowHeightChange={actions.onRowHeightChange} onRowHeightReset={actions.onRowHeightReset}
              />
            );
          })}
          {state.allTasks.length === 0 ? <PlanningGanttEmptyState variant="grid" /> : null}
        </div>
      </div>
    </div>
  );
}
