import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { columnStorageKey } from "./columnSizing";
import { ResizableDataTable } from "./ResizableDataTable";
import type { DataTableColumn } from "./types";

type Row = { id: string; email: string; name: string };

const rows: Row[] = [{ id: "row-1", email: "primary@example.test", name: "Primary Contact" }];
const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", defaultWidth: 180, minWidth: 120, maxWidth: 240, renderCell: (row) => row.name },
  { id: "email", header: "Email", defaultWidth: 220, renderCell: (row) => row.email, resizable: false }
];

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ResizableDataTable", () => {
  it("renders rows and supports keyboard row activation", () => {
    const select = vi.fn();
    render(table({ onRowClick: select, onRowKeyDown: (_event, row) => select(row.id) }));

    const row = screen.getByRole("row", { name: "Open Primary Contact" });
    expect(row).toHaveTextContent("Primary Contact");

    fireEvent.keyDown(row, { key: "Enter" });

    expect(select).toHaveBeenCalledWith("row-1");
  });

  it("resizes columns from the keyboard and persists the result", () => {
    render(table());
    const handle = screen.getByRole("separator", { name: "Resize Name column" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(storedWidth("name")).toBe(188);

    fireEvent.keyDown(handle, { key: "End" });
    expect(storedWidth("name")).toBe(240);

    fireEvent.doubleClick(handle);
    expect(storedWidth("name")).toBe(180);
  });

  it("resizes from the logical inline-end edge in RTL", () => {
    render(<div dir="rtl">{table()}</div>);
    const handle = screen.getByRole("separator", { name: "Resize Name column" });

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(storedWidth("name")).toBe(188);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(storedWidth("name")).toBe(180);

    fireEvent.pointerDown(handle, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 176, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(storedWidth("name")).toBe(204);
  });
});

function table(overrides: Partial<Parameters<typeof ResizableDataTable<Row>>[0]> = {}) {
  return (
    <ResizableDataTable
      ariaLabel="Contacts"
      columns={columns}
      emptyState={<p>No records</p>}
      getRowKey={(row) => row.id}
      rowAriaLabel={(row) => `Open ${row.name}`}
      rowTabIndex={() => 0}
      rows={rows}
      storageKey="test-table"
      {...overrides}
    />
  );
}

function storedWidth(columnId: string) {
  const stored = localStorage.getItem(columnStorageKey("test-table"));
  return stored ? JSON.parse(stored)[columnId] : undefined;
}
