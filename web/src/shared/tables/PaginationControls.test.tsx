import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "../localization/UokLocalization";
import { PaginationControls } from "./PaginationControls";

afterEach(cleanup);

describe("PaginationControls", () => {
  it("reports the visible range and dispatches page and size changes", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls
        label="Result paging"
        page={1}
        pageSize={25}
        hasNext
        totalCount={80}
        visibleCount={25}
        pageSizeLabel="Results per page"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    expect(screen.getByLabelText("Result paging")).toBeInTheDocument();
    expect(screen.getByLabelText("Showing records 26 through 50 of 80")).toHaveTextContent("26-50 / 80");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Results per page"), { target: { value: "50" } });

    expect(onPageChange).toHaveBeenNthCalledWith(1, 0);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("keeps boundary controls disabled and exposes an explicit empty status", () => {
    render(
      <PaginationControls
        label="Empty paging"
        page={0}
        pageSize={25}
        hasNext={false}
        totalCount={0}
        visibleCount={0}
        emptyStatusLabel="No matching records"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByLabelText("No matching records")).toHaveTextContent("0 / 0");
  });

  it("localizes default commands and number formatting", () => {
    render(<UokLocalizationProvider locale="ar"><PaginationControls
      label="ترقيم النتائج"
      page={0}
      pageSize={25}
      hasNext
      totalCount={30}
      visibleCount={25}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    /></UokLocalizationProvider>);

    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "التالي" })).toBeEnabled();
    expect(screen.getByLabelText("عرض السجلات ١ إلى ٢٥ من ٣٠")).toHaveTextContent("١-٢٥ / ٣٠");
    expect(screen.getByLabelText("حجم الصفحة")).toHaveDisplayValue("٢٥");
  });
});
