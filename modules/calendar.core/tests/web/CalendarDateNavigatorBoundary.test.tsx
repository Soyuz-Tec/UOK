import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarDateNavigator } from "../../web/src/CalendarDateNavigator";

describe("CalendarDateNavigator year boundaries", () => {
  afterEach(cleanup);

  it("keeps month and keyboard navigation inside the stable year range", async () => {
    render(
      <CalendarDateNavigator
        view="month"
        cursorDate={new Date(2027, 0, 1, 12)}
        onDateChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose date: January 2027" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose year: 2027" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Go to year" }), { target: { value: "1927" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    const dateGrid = screen.getByRole("grid", { name: "January 1927" });
    const firstDay = within(dateGrid).getByRole("gridcell", { name: "Saturday, January 1, 1927" });
    await waitFor(() => expect(firstDay).toHaveFocus());
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(within(dateGrid).getByRole("gridcell", { name: "Sunday, December 26, 1926" })).toBeDisabled();

    fireEvent.keyDown(firstDay, { key: "PageUp" });
    expect(screen.getByRole("grid", { name: "January 1927" })).toBeInTheDocument();
    expect(firstDay).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Choose year: 1927" }));
    const yearGrid = screen.getByRole("grid", { name: "Choose year: 1927–1939" });
    const minimumYear = within(yearGrid).getByRole("gridcell", { name: "1927" });
    await waitFor(() => expect(minimumYear).toHaveFocus());
    expect(minimumYear).toHaveAttribute("aria-selected", "true");
    expect(within(yearGrid).getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0)).toEqual([minimumYear]);
  });
});
