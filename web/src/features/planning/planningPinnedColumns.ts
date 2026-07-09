import type { ColumnWidthMap } from "../../shared/tables";
import type { PlanningGridColumn } from "./planningGanttModel";

export type PinnedColumnOffsetMap = Map<string, number>;

export function pinnedGridColumns<T extends Pick<PlanningGridColumn, "pinned">>(columns: T[]) {
  return [...columns.filter((column) => column.pinned), ...columns.filter((column) => !column.pinned)];
}

export function pinnedColumnOffsets(columns: PlanningGridColumn[], widths: ColumnWidthMap) {
  let left = 0;
  const offsets: PinnedColumnOffsetMap = new Map();
  for (const column of columns) {
    if (!column.pinned) continue;
    offsets.set(column.id, left);
    left += widths[column.id] ?? column.defaultWidth;
  }
  return offsets;
}
