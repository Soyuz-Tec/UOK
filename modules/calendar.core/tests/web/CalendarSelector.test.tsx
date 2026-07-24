import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { CalendarSelector } from "../../web/src/CalendarSelector";

describe("CalendarSelector", () => {
  afterEach(cleanup);

  it("hides a large collection in a searchable single-scope panel", async () => {
    const calendars = Array.from({ length: 75 }, (_, index) => ({
      id: `calendar-${index + 1}`,
      name: index === 74 ? "Release calendar" : `Calendar ${index + 1}`,
      color: index === 74 ? "#2563eb" : null,
      status: "active",
      timezone: "UTC",
      etag: `"calendar-sha256-${index + 1}"`,
      user_managed: true,
      can_delete: true,
      can_restore: false,
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
      calendars={[calendarRecord("calendar-1", "Operations")]}
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

  it("preserves the full selected calendar name for accessible and hover disclosure", () => {
    const name = "Candidate Calendar 1783741787404 with a deliberately long operational title";
    render(<CalendarSelector
      calendars={[{ ...calendarRecord("calendar-1", name), color: "#2563eb" }]}
      scopeId="calendar-1"
      onScopeChange={vi.fn()}
      onCreateCalendar={vi.fn()}
    />);

    const trigger = screen.getByRole("button", { name: `Calendar display: ${name}` });
    expect(trigger.querySelector(".calendar-selector-current")).toHaveAttribute("title", name);
  });

  it("confirms deletion for one selected calendar and disables management without capability", async () => {
    const calendar = { id: "calendar-1", name: "Operations", color: null, status: "active", timezone: "UTC", etag: '"calendar-sha256-active"', user_managed: true, can_delete: true, can_restore: false };
    const onDeleteCalendar = vi.fn(async () => undefined);
    const { rerender } = render(<CalendarSelector
      calendars={[calendar]}
      scopeId="calendar-1"
      onScopeChange={vi.fn()}
      onCreateCalendar={vi.fn()}
      onDeleteCalendar={onDeleteCalendar}
      canCreateCalendar
      canDeleteCalendar
    />);

    const trigger = screen.getByRole("button", { name: "Calendar display: Operations" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete calendar" }));
    const dialog = screen.getByRole("dialog", { name: "Delete calendar" });
    expect(dialog).toHaveTextContent("Operations");
    expect(dialog).toHaveTextContent("retained for audit");
    expect(dialog).toHaveTextContent("restore it from Deleted calendars");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete calendar" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Delete calendar" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Delete calendar" })).getByRole("button", { name: "Delete calendar" }));
    await waitFor(() => expect(onDeleteCalendar).toHaveBeenCalledWith(calendar));
    await waitFor(() => expect(trigger).toHaveFocus());

    rerender(<CalendarSelector
      calendars={[calendar]}
      scopeId="calendar-1"
      onScopeChange={vi.fn()}
      onCreateCalendar={vi.fn()}
      onDeleteCalendar={onDeleteCalendar}
      canCreateCalendar={false}
      canDeleteCalendar={false}
    />);
    if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Delete calendar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New calendar" })).toBeDisabled();
  });

  it("discovers and restores deleted calendars while hiding delete for a system-managed record", async () => {
    const system = { id: "calendar-system", name: "Compliance", color: null, status: "active", timezone: "UTC", etag: '"calendar-sha256-system"', user_managed: false, can_delete: false, can_restore: false };
    const deleted = { id: "calendar-deleted", name: "Former operations", color: null, status: "deleted", timezone: "UTC", etag: '"calendar-sha256-deleted"', user_managed: true, can_delete: false, can_restore: true };
    const onRestoreCalendar = vi.fn(async () => undefined);
    render(<CalendarSelector
      calendars={[system]}
      deletedCalendars={[deleted]}
      scopeId={system.id}
      onScopeChange={vi.fn()}
      onCreateCalendar={vi.fn()}
      onDeleteCalendar={vi.fn()}
      onRestoreCalendar={onRestoreCalendar}
      canCreateCalendar
      canDeleteCalendar
      canRestoreCalendar
    />);

    const trigger = screen.getByRole("button", { name: "Calendar display: Compliance" });
    fireEvent.click(trigger);
    expect(screen.queryByRole("button", { name: "Delete calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("system-managed");
    fireEvent.click(screen.getByRole("button", { name: "Restore calendar: Former operations" }));
    const dialog = screen.getByRole("dialog", { name: "Restore calendar" });
    expect(dialog).toHaveTextContent("retained events, participants, and reminders");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore calendar" }));

    await waitFor(() => expect(onRestoreCalendar).toHaveBeenCalledWith(deleted));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("unmounts a stale delete confirmation when its target disappears", async () => {
    const calendarA = calendarRecord("calendar-a", "Calendar A");
    const calendarB = calendarRecord("calendar-b", "Calendar B");
    const onDeleteCalendar = vi.fn(async () => undefined);
    const props = {
      onScopeChange: vi.fn(),
      onCreateCalendar: vi.fn(),
      onDeleteCalendar,
      canCreateCalendar: true,
      canDeleteCalendar: true,
    };
    const { rerender } = render(
      <CalendarSelector {...props} calendars={[calendarA, calendarB]} scopeId={calendarA.id} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Calendar display: Calendar A" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete calendar" }));
    expect(screen.getByRole("dialog", { name: "Delete calendar" })).toHaveTextContent("Calendar A");

    rerender(
      <CalendarSelector
        {...props}
        calendars={[calendarB]}
        deletedCalendars={[{ ...calendarA, status: "deleted", can_delete: false, can_restore: true }]}
        scopeId={calendarB.id}
      />,
    );

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete calendar" })).not.toBeInTheDocument());
    expect(onDeleteCalendar).not.toHaveBeenCalled();
    const survivingTrigger = screen.getByRole("button", { name: "Calendar display: Calendar B" });
    await waitFor(() => expect(survivingTrigger).toHaveFocus());
  });
});

function calendarRecord(id: string, name: string) {
  return {
    id, name, color: null, status: "active", timezone: "UTC", etag: `"calendar-sha256-${id}"`,
    user_managed: true, can_delete: true, can_restore: false,
  };
}
