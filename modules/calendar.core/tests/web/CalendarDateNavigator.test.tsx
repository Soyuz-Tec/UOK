import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarDateNavigator } from "../../web/src/CalendarDateNavigator";
import { dayKey } from "../../web/src/calendarDates";

const cursorDate = new Date(2027, 0, 1, 12);

describe("CalendarDateNavigator", () => {
  afterEach(cleanup);

  it("keeps the 42-day picker hidden until the range title opens it", async () => {
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Choose date: January 2027" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const grid = screen.getByRole("grid", { name: "January 2027" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
    const selected = within(grid).getByRole("gridcell", { name: "Friday, January 1, 2027" });
    await waitFor(() => expect(selected).toHaveFocus());
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(within(grid).getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0)).toEqual([selected]);
    expect(screen.getByRole("button", { name: "Choose year: 2027" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and restores focus to the range trigger", async () => {
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Choose date: January 2027" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Friday, January 1, 2027" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("selects an adjacent-month date and restores trigger focus", async () => {
    const onDateChange = vi.fn();
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={onDateChange} />);

    const trigger = screen.getByRole("button", { name: "Choose date: January 2027" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("gridcell", { name: "Sunday, December 27, 2026" }));

    await waitFor(() => expect(onDateChange).toHaveBeenCalledTimes(1));
    expect(dayKey(onDateChange.mock.calls[0][0])).toBe("2026-12-27");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("browses months without changing the workspace until a date is chosen", async () => {
    const onDateChange = vi.fn();
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={onDateChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose date: January 2027" }));
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Friday, January 1, 2027" })).toHaveFocus());
    const nextMonth = screen.getByRole("button", { name: "Next month" });
    nextMonth.focus();
    fireEvent.click(nextMonth);
    expect(screen.getByRole("grid", { name: "February 2027" })).toBeInTheDocument();
    await waitFor(() => expect(nextMonth).toHaveFocus());
    nextMonth.focus();
    fireEvent.click(nextMonth);
    expect(screen.getByRole("grid", { name: "March 2027" })).toBeInTheDocument();
    await waitFor(() => expect(nextMonth).toHaveFocus());
    expect(onDateChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("gridcell", { name: "Monday, March 1, 2027" }));
    await waitFor(() => expect(onDateChange).toHaveBeenCalledTimes(1));
    expect(dayKey(onDateChange.mock.calls[0][0])).toBe("2027-03-01");
  });

  it("browses directly to a year without changing the workspace until a date is chosen", async () => {
    const onDateChange = vi.fn();
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={onDateChange} />);

    const trigger = screen.getByRole("button", { name: "Choose date: January 2027" });
    fireEvent.click(trigger);
    const yearTrigger = screen.getByRole("button", { name: "Choose year: 2027" });
    fireEvent.click(yearTrigger);
    expect(yearTrigger).toHaveAttribute("aria-expanded", "true");
    const yearGrid = screen.getByRole("grid", { name: "Choose year: 2020–2039" });
    expect(within(yearGrid).getAllByRole("gridcell")).toHaveLength(20);
    const selectedYear = within(yearGrid).getByRole("gridcell", { name: "2027" });
    await waitFor(() => expect(selectedYear).toHaveFocus());
    expect(selectedYear).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(yearGrid).getByRole("gridcell", { name: "2032" }));
    expect(screen.getByRole("grid", { name: "January 2032" })).toBeInTheDocument();
    expect(onDateChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("gridcell", { name: /January 1, 2032/ })).toHaveFocus());

    fireEvent.click(screen.getByRole("gridcell", { name: /January 1, 2032/ }));
    await waitFor(() => expect(onDateChange).toHaveBeenCalledTimes(1));
    expect(dayKey(onDateChange.mock.calls[0][0])).toBe("2032-01-01");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("returns from the inline year view before Escape closes the date navigator", async () => {
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Choose date: January 2027" });
    fireEvent.click(trigger);
    const yearTrigger = screen.getByRole("button", { name: "Choose year: 2027" });
    fireEvent.click(yearTrigger);
    const selectedYear = screen.getByRole("gridcell", { name: "2027" });
    await waitFor(() => expect(selectedYear).toHaveFocus());
    fireEvent.keyDown(selectedYear, { key: "Escape" });

    await waitFor(() => expect(yearTrigger).toHaveFocus());
    expect(yearTrigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  it("preserves the month and clamps leap day when changing years", async () => {
    const leapDay = new Date(2028, 1, 29, 12);
    const onDateChange = vi.fn();
    render(<CalendarDateNavigator view="month" cursorDate={leapDay} onDateChange={onDateChange} />);

    const trigger = screen.getByRole("button", { name: "Choose date: February 2028" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Choose year: 2028" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "2027" }));

    expect(screen.getByRole("grid", { name: "February 2027" })).toBeInTheDocument();
    const clampedDay = screen.getByRole("gridcell", { name: /February 28, 2027/ });
    expect(clampedDay).toHaveAttribute("tabindex", "0");
    await waitFor(() => expect(clampedDay).toHaveFocus());
    fireEvent.click(clampedDay);

    await waitFor(() => expect(onDateChange).toHaveBeenCalledTimes(1));
    expect(dayKey(onDateChange.mock.calls[0][0])).toBe("2027-02-28");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("uses roving arrow-key focus and native selection", async () => {
    const onDateChange = vi.fn();
    render(<CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={onDateChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose date: January 2027" }));
    const first = screen.getByRole("gridcell", { name: "Friday, January 1, 2027" });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("gridcell", { name: "Saturday, January 2, 2027" });
    await waitFor(() => expect(second).toHaveFocus());
    fireEvent.keyDown(second, { key: "ArrowDown" });
    const ninth = screen.getByRole("gridcell", { name: "Saturday, January 9, 2027" });
    await waitFor(() => expect(ninth).toHaveFocus());
    fireEvent.click(ninth);
    await waitFor(() => expect(onDateChange).toHaveBeenCalledTimes(1));
    expect(dayKey(onDateChange.mock.calls[0][0])).toBe("2027-01-09");
  });

  it("localizes the date navigator and month commands in Arabic", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <CalendarDateNavigator view="month" cursorDate={cursorDate} onDateChange={vi.fn()} />
      </UokLocalizationProvider>,
    );

    const trigger = screen.getByRole("button", { name: /اختر تاريخا/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "الشهر السابق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الشهر التالي" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /يناير/ })).toBeInTheDocument();
    const yearTrigger = screen.getByRole("button", { name: "اختر السنة: ٢٠٢٧" });
    fireEvent.click(yearTrigger);
    expect(screen.getByRole("button", { name: "السنوات العشرون السابقة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "السنوات العشرون التالية" })).toBeInTheDocument();
    const yearGrid = screen.getByRole("grid", { name: "اختر السنة: ٢٠٢٠–٢٠٣٩" });
    expect(within(yearGrid).getByRole("gridcell", { name: "٢٠٢٧" })).toHaveAttribute("aria-selected", "true");
  });
});
