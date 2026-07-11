import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { SearchWorkspace } from "./SearchWorkspace";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("SearchWorkspace", () => {
  it("keeps live refinements open and restores trigger focus when dismissed", async () => {
    render(<SearchHarness />);
    const trigger = screen.getByRole("button", { name: "Search options: All records" });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "open" } });
    expect(screen.getByRole("button", { name: "Search options: Status: Open" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Category" }));
    expect(screen.getByRole("button", { name: "Search options: Status: Open; Section: Category" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    const resetTrigger = screen.getByRole("button", { name: "Search options: All records" });
    expect(resetTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(resetTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(resetTrigger).toHaveFocus();
  });

  it("persists named searches while leaving raw query text transient", () => {
    const view = render(<SearchHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search records" }), { target: { value: "dispatch" } });
    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "Dispatch review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));

    expect(screen.getByRole("button", { name: "Apply Dispatch review" })).toBeInTheDocument();
    view.unmount();
    render(<SearchHarness />);

    expect(screen.getByRole("textbox", { name: "Search records" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Dispatch review" }));
    expect(screen.getByRole("textbox", { name: "Search records" })).toHaveValue("dispatch");
  });

  it("prevents user searches from duplicating locked preset names", () => {
    render(<SearchHarness withPreset />);
    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));

    expect(screen.getAllByRole("button", { name: "Apply All records" })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "  ALL RECORDS  " } });
    expect(screen.getByRole("button", { name: "Save search" })).toBeDisabled();
  });

  it("localizes shared search-panel chrome in Arabic", () => {
    render(<UokLocalizationProvider locale="ar"><SearchHarness /></UokLocalizationProvider>);
    fireEvent.click(screen.getByRole("button", { name: "خيارات البحث: All records" }));

    expect(screen.getByRole("dialog", { name: "خيارات البحث" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "عوامل التصفية" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حفظ البحث" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "تم" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status عامل تصفية"), { target: { value: "open" } });
    fireEvent.click(screen.getByRole("button", { name: "Category" }));
    expect(screen.getByLabelText("تحسينات البحث النشطة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /خيارات البحث:/ })).toHaveTextContent("٢ تحسينات");
  });
});

function SearchHarness({ withPreset = false }: { withPreset?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [groupBy, setGroupBy] = useState("none");
  return (
    <SearchWorkspace
      label="Search records"
      value={query}
      placeholder="Search records"
      defaultSummaryLabel="All records"
      filters={[{
        id: "status",
        label: "Status",
        value: status,
        defaultValue: "all",
        options: [{ value: "all", label: "All statuses" }, { value: "open", label: "Open" }],
        onChange: setStatus,
      }]}
      groupBy={groupBy}
      groupOptions={[{ value: "none", label: "No grouping" }, { value: "category", label: "Category" }]}
      savedViewsStorageKey="search-workspace-test"
      presetViews={withPreset ? [{ id: "all-records", name: "All records", query: "", filters: {}, groupBy: "none", locked: true }] : []}
      onChange={setQuery}
      onGroupByChange={setGroupBy}
      onClear={() => {
        setQuery("");
        setStatus("all");
      }}
    />
  );
}
