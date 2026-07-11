import type { CalendarEventRecord } from "./calendarTypes";

export function filterCalendarEvents(
  events: CalendarEventRecord[],
  query: string,
  statusFilter: string,
  availabilityFilter: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return events.filter((event) => {
    if (statusFilter === "active" && event.status === "canceled") return false;
    if (statusFilter === "canceled" && event.status !== "canceled") return false;
    if (availabilityFilter !== "all" && event.transparency !== availabilityFilter) return false;
    if (!normalizedQuery) return true;
    const searchable = [event.title, event.location, event.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}
