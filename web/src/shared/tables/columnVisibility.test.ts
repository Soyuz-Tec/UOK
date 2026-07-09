import { afterEach, describe, expect, it } from "vitest";

import {
  columnVisibilityStorageKey,
  defaultColumnVisibility,
  readColumnVisibility,
  type ColumnVisibilityOption
} from "./columnVisibility";

const options: ColumnVisibilityOption[] = [
  { id: "name", label: "Name", locked: true },
  { id: "email", label: "Email" },
  { id: "notes", label: "Notes", defaultVisible: false }
];

afterEach(() => {
  localStorage.clear();
});

describe("column visibility", () => {
  it("uses defaults and keeps locked columns visible", () => {
    expect(defaultColumnVisibility(options)).toEqual({ email: true, name: true, notes: false });
  });

  it("reads persisted choices and ignores invalid storage", () => {
    localStorage.setItem(columnVisibilityStorageKey("contacts"), JSON.stringify({ email: false, name: false, notes: true }));

    expect(readColumnVisibility(options, "contacts")).toEqual({ email: false, name: true, notes: true });

    localStorage.setItem(columnVisibilityStorageKey("contacts"), "{broken");

    expect(readColumnVisibility(options, "contacts")).toEqual({ email: true, name: true, notes: false });
  });
});
