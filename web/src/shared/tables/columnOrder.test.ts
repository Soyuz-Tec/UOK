import { afterEach, describe, expect, it } from "vitest";

import { columnOrderStorageKey, moveColumnBefore, normalizeColumnOrder, readColumnOrder } from "./columnOrder";

const columns = [{ id: "wbs" }, { id: "task" }, { id: "start" }, { id: "end" }];

afterEach(() => {
  localStorage.clear();
});

describe("column order", () => {
  it("normalizes persisted ids and appends new columns", () => {
    expect(normalizeColumnOrder(columns, ["end", "missing", "task", "task"]).map((column) => column.id)).toEqual(["end", "task", "wbs", "start"]);
  });

  it("moves a source column before the target column", () => {
    expect(moveColumnBefore(columns, "end", "task").map((column) => column.id)).toEqual(["wbs", "end", "task", "start"]);
  });

  it("reads persisted order and ignores invalid storage", () => {
    localStorage.setItem(columnOrderStorageKey("planning"), JSON.stringify(["start", "task"]));
    expect(readColumnOrder(columns, "planning").map((column) => column.id)).toEqual(["start", "task", "wbs", "end"]);

    localStorage.setItem(columnOrderStorageKey("planning"), "{broken");
    expect(readColumnOrder(columns, "planning").map((column) => column.id)).toEqual(["wbs", "task", "start", "end"]);
  });
});
