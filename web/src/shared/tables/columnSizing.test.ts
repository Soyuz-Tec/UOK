import { afterEach, describe, expect, it } from "vitest";

import { clampColumnWidth, columnStorageKey, readColumnWidths } from "./columnSizing";
import type { DataTableColumn } from "./types";

type Row = { name: string };

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", defaultWidth: 220, minWidth: 120, maxWidth: 320, renderCell: (row) => row.name },
  { id: "notes", header: "Notes", defaultWidth: 260, minWidth: 160, maxWidth: 420, renderCell: (row) => row.name }
];

afterEach(() => {
  localStorage.clear();
});

describe("column sizing", () => {
  it("clamps unsafe widths into the column limits", () => {
    expect(clampColumnWidth(10, 120, 320)).toBe(120);
    expect(clampColumnWidth(900, 120, 320)).toBe(320);
    expect(clampColumnWidth(Number.NaN, 120, 320)).toBe(120);
  });

  it("reads persisted widths and ignores invalid storage", () => {
    localStorage.setItem(columnStorageKey("contacts"), JSON.stringify({ name: 999, notes: 180 }));

    expect(readColumnWidths(columns, "contacts")).toEqual({ name: 320, notes: 180 });

    localStorage.setItem(columnStorageKey("contacts"), "{broken");

    expect(readColumnWidths(columns, "contacts")).toEqual({ name: 220, notes: 260 });
  });
});
