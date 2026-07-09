import type { ColumnWidthMap } from "./types";

export type PinnedColumnOffsetMap = Map<string, number>;
export type PinnableColumn = { id: string; defaultWidth: number; pinned?: boolean };

export function pinnedColumns<T extends Pick<PinnableColumn, "pinned">>(columns: T[]) {
  return [...columns.filter((column) => column.pinned), ...columns.filter((column) => !column.pinned)];
}

export function pinnedColumnOffsets<T extends PinnableColumn>(columns: T[], widths: ColumnWidthMap) {
  let left = 0;
  const offsets: PinnedColumnOffsetMap = new Map();
  for (const column of columns) {
    if (!column.pinned) continue;
    offsets.set(column.id, left);
    left += widths[column.id] ?? column.defaultWidth;
  }
  return offsets;
}
