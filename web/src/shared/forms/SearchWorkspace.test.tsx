import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { SearchWorkspace } from "./SearchWorkspace";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
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

  it("can scope saved searches to session storage without changing the local default", () => {
    const view = render(<SearchHarness storageKind="session" />);
    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search records" }), {
      target: { value: "dispatch" },
    });
    fireEvent.change(screen.getByLabelText("Saved search name"), {
      target: { value: "Session dispatch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));

    expect(window.sessionStorage.getItem("search-workspace-test"))
      .toContain("Session dispatch");
    expect(window.localStorage.getItem("search-workspace-test")).toBeNull();
    view.unmount();
    render(<SearchHarness storageKind="session" />);

    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));
    expect(screen.getByRole("button", { name: "Apply Session dispatch" }))
      .toBeInTheDocument();
  });

  it("prevents user searches from duplicating locked preset names", () => {
    render(<SearchHarness withPreset />);
    fireEvent.click(screen.getByRole("button", { name: "Search options: All records" }));

    expect(screen.getAllByRole("button", { name: "Apply All records" })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "  ALL RECORDS  " } });
    expect(screen.getByRole("button", { name: "Save search" })).toBeDisabled();
  });

  it("keeps module-owned supplemental actions inside the options panel", async () => {
    render(<SearchHarness withSupplementalSection />);
    const trigger = screen.getByRole("button", { name: "Search options: All records" });

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Search options" });
    const recordActions = within(dialog).getByRole("region", { name: "Record actions" });
    expect(within(recordActions).getByRole("button", { name: "Refresh records" })).toBeInTheDocument();

    fireEvent.click(within(recordActions).getByRole("button", { name: "Refresh records" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
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

function SearchHarness({
  storageKind,
  withPreset = false,
  withSupplementalSection = false,
}: {
  storageKind?: "local" | "session";
  withPreset?: boolean;
  withSupplementalSection?: boolean;
}) {
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
      savedViewsStorageKind={storageKind}
      presetViews={withPreset ? [{ id: "all-records", name: "All records", query: "", filters: {}, groupBy: "none", locked: true }] : []}
      supplementalSections={withSupplementalSection ? ({ close }) => (
        <section className="search-workspace-section" aria-label="Record actions">
          <h3>Record actions</h3>
          <button type="button" onClick={close}>Refresh records</button>
        </section>
      ) : undefined}
      onChange={setQuery}
      onGroupByChange={setGroupBy}
      onClear={() => {
        setQuery("");
        setStatus("all");
      }}
    />
  );
}
