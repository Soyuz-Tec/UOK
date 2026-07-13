import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarSelector } from "../../web/src/CalendarSelector";

describe("CalendarSelector", () => {
  it("hides a large collection in a searchable single-scope panel", async () => {
    const calendars = Array.from({ length: 75 }, (_, index) => ({
      id: `calendar-${index + 1}`,
      name: index === 74 ? "Release calendar" : `Calendar ${index + 1}`,
      color: index === 74 ? "#2563eb" : null,
      status: "active",
      timezone: "UTC",
    }));
    const onScopeChange = vi.fn();

    render(<CalendarSelector calendars={calendars} scopeId="calendar-1" onScopeChange={onScopeChange} onCreateCalendar={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Calendar display: Calendar 1" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: "Find calendars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Find calendars" })).toHaveFocus());
    expect(screen.getAllByRole("radio")).toHaveLength(76);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find calendars" }), { target: { value: "Release" } });
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Calendar 1/ })).toBeChecked();
    const release = screen.getByRole("radio", { name: /Release calendar/ });
    expect(release.parentElement?.querySelector(".calendar-color-dot")).toHaveStyle("--calendar-color: #2563EB");
    fireEvent.click(release);
    await waitFor(() => expect(onScopeChange).toHaveBeenCalledWith("calendar-75"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: "Find calendars" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and restores focus to the current-calendar trigger", async () => {
    render(<CalendarSelector
      calendars={[{ id: "calendar-1", name: "Operations", color: null, status: "active", timezone: "UTC" }]}
      scopeId="calendar-1"
      onScopeChange={vi.fn()}
      onCreateCalendar={vi.fn()}
    />);

    const trigger = screen.getByRole("button", { name: "Calendar display: Operations" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Find calendars" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  it("localizes the collapsed all-calendar context", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <CalendarSelector calendars={[]} scopeId="" onScopeChange={vi.fn()} onCreateCalendar={vi.fn()} />
      </UokLocalizationProvider>,
    );

    expect(screen.getByRole("button", { name: "عرض التقويم: كل التقاويم" })).toHaveAttribute("aria-expanded", "false");
  });
});
