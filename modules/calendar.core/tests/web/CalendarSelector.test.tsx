import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { CalendarSelector } from "../../web/src/CalendarSelector";

describe("CalendarSelector", () => {
  it("keeps a large calendar collection searchable and single-scoped", () => {
    const calendars = Array.from({ length: 75 }, (_, index) => ({
      id: `calendar-${index + 1}`,
      name: index === 74 ? "Release calendar" : `Calendar ${index + 1}`,
      color: index === 74 ? "#2563eb" : null,
      status: "active",
      timezone: "UTC",
    }));
    const onScopeChange = vi.fn();

    render(<CalendarSelector calendars={calendars} scopeId="calendar-1" onScopeChange={onScopeChange} onCreateCalendar={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(76);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find calendars" }), { target: { value: "Release" } });
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Calendar 1/ })).toBeChecked();
    const release = screen.getByRole("radio", { name: /Release calendar/ });
    expect(release.parentElement?.querySelector(".calendar-color-dot")).toHaveStyle("--calendar-color: #2563EB");
    fireEvent.click(release);
    expect(onScopeChange).toHaveBeenCalledWith("calendar-75");
  });
});
