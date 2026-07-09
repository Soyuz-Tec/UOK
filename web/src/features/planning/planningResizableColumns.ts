import type { DataTableColumn } from "../../shared/tables";
import type { PlanningTask } from "./types";
import type { PlanningGridColumn } from "./planningGanttModel";

export function toResizablePlanningColumn(column: PlanningGridColumn): DataTableColumn<PlanningTask> {
  return {
    id: column.id,
    header: column.label,
    defaultWidth: column.defaultWidth,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth,
    resizable: column.resizable,
    renderCell: () => null,
  };
}
