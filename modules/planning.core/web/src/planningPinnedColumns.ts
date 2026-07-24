import { pinnedColumnOffsets as sharedPinnedColumnOffsets, pinnedColumns } from "@uok/shared/tables";
import type { ColumnWidthMap, PinnedColumnOffsetMap } from "@uok/shared/tables";
import type { PlanningGridColumn } from "./planningGanttModel";

export function pinnedGridColumns<T extends Pick<PlanningGridColumn, "pinned">>(columns: T[]) {
  return pinnedColumns(columns);
}

export function pinnedColumnOffsets(columns: PlanningGridColumn[], widths: ColumnWidthMap) {
  return sharedPinnedColumnOffsets(columns, widths);
}

export type { PinnedColumnOffsetMap };
