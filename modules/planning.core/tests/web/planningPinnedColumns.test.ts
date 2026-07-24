import { describe, expect, it } from "vitest";

import { pinnedColumnOffsets, pinnedGridColumns } from "../../web/src/planningPinnedColumns";
import type { PlanningGridColumn } from "../../web/src/planningGanttModel";

const columns: PlanningGridColumn[] = [
  column("end", 120),
  column("task", 240, true),
  column("start", 120),
  column("wbs", 64, true),
];

describe("planning pinned columns", () => {
  it("keeps pinned columns before manually ordered columns", () => {
    expect(pinnedGridColumns(columns).map((item) => item.id)).toEqual(["task", "wbs", "end", "start"]);
  });

  it("computes sticky offsets from current widths", () => {
    const offsets = pinnedColumnOffsets(pinnedGridColumns(columns), { task: 260, wbs: 80 });
    expect(Array.from(offsets.entries())).toEqual([["task", 0], ["wbs", 260]]);
  });
});

function column(id: string, defaultWidth: number, pinned = false): PlanningGridColumn {
  return { id, label: id, defaultWidth, minWidth: 40, maxWidth: 300, pinned };
}
