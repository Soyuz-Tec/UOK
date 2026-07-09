import { describe, expect, it } from "vitest";

import { clampRowHeight, pinnedColumnOffsets, pinnedColumns, rowLayoutMap, rowLayouts } from "./index";

describe("shared table feature utilities", () => {
  it("orders pinned columns before scrollable columns and computes sticky offsets", () => {
    const columns = [
      { id: "end", defaultWidth: 110 },
      { id: "task", defaultWidth: 260, pinned: true },
      { id: "wbs", defaultWidth: 80, pinned: true },
    ];
    const ordered = pinnedColumns(columns);
    const offsets = pinnedColumnOffsets(ordered, { task: 250, wbs: 90 });

    expect(ordered.map((column) => column.id)).toEqual(["task", "wbs", "end"]);
    expect(offsets.get("task")).toBe(0);
    expect(offsets.get("wbs")).toBe(250);
  });

  it("stores generic row layouts by stable row id", () => {
    const state = rowLayouts([{ id: "a" }, { id: "b" }], (row) => row.id, 36, { b: 60 }, 32, 96);
    const byId = rowLayoutMap(state.layouts);

    expect(clampRowHeight(12, 32, 96)).toBe(32);
    expect(state.totalHeight).toBe(96);
    expect(byId.get("b")?.top).toBe(36);
    expect(byId.get("b")?.height).toBe(60);
  });
});
