import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarYearPicker } from "../../web/src/CalendarYearPicker";

describe("CalendarYearPicker", () => {
  afterEach(cleanup);

  it("pages through readable 20-year grids with roving keyboard focus", async () => {
    render(
      <CalendarYearPicker
        id="year-picker"
        year={2027}
        minYear={1927}
        maxYear={2127}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const initialGrid = screen.getByRole("grid", { name: "Choose year: 2020–2039" });
    expect(within(initialGrid).getAllByRole("gridcell")).toHaveLength(20);
    await waitFor(() => expect(within(initialGrid).getByRole("gridcell", { name: "2027" })).toHaveFocus());

    const nextRange = screen.getByRole("button", { name: "Next 20 years" });
    fireEvent.click(nextRange);
    const nextGrid = screen.getByRole("grid", { name: "Choose year: 2040–2059" });
    const activeYear = within(nextGrid).getByRole("gridcell", { name: "2047" });
    expect(activeYear).toHaveAttribute("tabindex", "0");
    activeYear.focus();
    fireEvent.keyDown(activeYear, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "2048" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("gridcell", { name: "2048" }), { key: "PageDown" });
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "2068" })).toHaveFocus());
    expect(screen.getByRole("grid", { name: "Choose year: 2060–2079" })).toBeInTheDocument();
  });

  it("jumps to an exact year and explains the stable supported range", () => {
    const onSelect = vi.fn();
    render(
      <CalendarYearPicker
        id="year-picker"
        year={2027}
        minYear={1927}
        maxYear={2127}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Go to year" });
    fireEvent.change(input, { target: { value: "2128" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a year from 1927–2127.");
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "2042" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onSelect).toHaveBeenCalledWith(2042);
  });

  it("accepts Arabic numerals and mirrors horizontal year navigation", async () => {
    const onSelect = vi.fn();
    render(
      <UokLocalizationProvider locale="ar">
        <CalendarYearPicker
          id="year-picker"
          year={2027}
          minYear={1927}
          maxYear={2127}
          onSelect={onSelect}
          onCancel={vi.fn()}
        />
      </UokLocalizationProvider>,
    );

    const selectedYear = screen.getByRole("gridcell", { name: "٢٠٢٧" });
    await waitFor(() => expect(selectedYear).toHaveFocus());
    fireEvent.keyDown(selectedYear, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "٢٠٢٨" })).toHaveFocus());

    const input = screen.getByRole("textbox", { name: "الانتقال إلى سنة" });
    expect(input).toHaveValue("٢٠٢٧");
    fireEvent.change(input, { target: { value: "٢٠٤٢" } });
    fireEvent.click(screen.getByRole("button", { name: "انتقال" }));
    expect(onSelect).toHaveBeenCalledWith(2042);
  });
});
