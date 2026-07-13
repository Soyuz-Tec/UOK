import { CalendarClock, ChevronLeft, ChevronRight, List, Rows3, Table2 } from "lucide-react";

import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkspaceCommandBar } from "@uok/shared/layout";
import { CommandButton, IconButton, SegmentedControl } from "@uok/shared/primitives";
import { CalendarDateNavigator } from "./CalendarDateNavigator";
import { CalendarSelector } from "./CalendarSelector";
import type { CalendarRecord, CalendarView } from "./calendarTypes";

const viewOptions = [
  { id: "month" as const, label: "Month", icon: Table2 },
  { id: "week" as const, label: "Week", icon: Rows3 },
  { id: "day" as const, label: "Day", icon: CalendarClock },
  { id: "agenda" as const, label: "Agenda", icon: List },
];

export function CalendarToolbar({
  view,
  cursorDate,
  calendars,
  activeCalendarId,
  query,
  statusFilter,
  availabilityFilter,
  onViewChange,
  onDateChange,
  onCalendarChange,
  onCreateCalendar,
  onQueryChange,
  onStatusFilterChange,
  onAvailabilityFilterChange,
  onClearFilters,
  onToday,
  onMove,
  onCreate,
  onRefresh,
  onExport,
}: {
  view: CalendarView;
  cursorDate: Date;
  calendars: CalendarRecord[];
  activeCalendarId: string;
  query: string;
  statusFilter: string;
  availabilityFilter: string;
  onViewChange: (view: CalendarView) => void;
  onDateChange: (date: Date) => void;
  onCalendarChange: (calendarId: string) => void;
  onCreateCalendar: () => void;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
  onAvailabilityFilterChange: (availability: string) => void;
  onClearFilters: () => void;
  onToday: () => void;
  onMove: (direction: -1 | 1) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <WorkspaceCommandBar
      label="Calendar controls"
      className="calendar-toolbar"
      query={(
        <SearchWorkspace
          label="Search events"
          value={query}
          onChange={onQueryChange}
          placeholder="Search events"
          defaultSummaryLabel="Active events"
          filters={[
            { id: "status", label: "Status", value: statusFilter, defaultValue: "active", options: statusOptions, onChange: onStatusFilterChange },
            { id: "availability", label: "Show as", value: availabilityFilter, defaultValue: "all", options: availabilityOptions, onChange: onAvailabilityFilterChange },
          ]}
          groupBy="none"
          groupOptions={[]}
          savedViewsStorageKey="uok_calendar_saved_search_views"
          onGroupByChange={() => undefined}
          onClear={onClearFilters}
        />
      )}
      context={(
        <div className="calendar-context-controls">
          <CalendarSelector
            calendars={calendars}
            scopeId={activeCalendarId}
            onScopeChange={onCalendarChange}
            onCreateCalendar={onCreateCalendar}
          />
          <div className="calendar-range-group">
            <CommandButton icon={CalendarClock} onClick={onToday}>Today</CommandButton>
            <IconButton icon={ChevronLeft} label="Previous range" onClick={() => onMove(-1)} />
            <CalendarDateNavigator view={view} cursorDate={cursorDate} onDateChange={onDateChange} />
            <IconButton icon={ChevronRight} label="Next range" onClick={() => onMove(1)} />
          </div>
        </div>
      )}
      view={<SegmentedControl value={view} onChange={onViewChange} options={viewOptions} label="Calendar view" iconOnly />}
      secondaryActions={<WorkspaceActionsMenu items={[
        { id: "export", action: "export", labelKey: "command.exportIcs", fallbackLabel: "Export ICS", onSelect: onExport },
        { id: "refresh", action: "refresh", onSelect: onRefresh },
      ]} />}
      primaryAction={<WorkspaceActionButton action="create" labelKey="command.newEvent" fallbackLabel="New event" onClick={onCreate} primary />}
    />
  );
}

const statusOptions = [
  { value: "active", label: "Active events" },
  { value: "all", label: "All events" },
  { value: "canceled", label: "Canceled events" },
];

const availabilityOptions = [
  { value: "all", label: "Any availability" },
  { value: "busy", label: "Busy" },
  { value: "free", label: "Free" },
];
