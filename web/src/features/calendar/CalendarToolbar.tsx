import { CalendarClock, ChevronLeft, ChevronRight, Download, List, Plus, RefreshCw, Rows3, Table2 } from "lucide-react";

import { CommandButton, IconButton, SegmentedControl } from "../../shared/primitives";
import type { CalendarRecord, CalendarView } from "./calendarTypes";
import { viewTitle } from "./calendarDates";

const viewOptions = [
  { id: "month" as const, label: "Month", icon: Table2 },
  { id: "week" as const, label: "Week", icon: Rows3 },
  { id: "day" as const, label: "Day", icon: CalendarClock },
  { id: "agenda" as const, label: "Agenda", icon: List },
];

export function CalendarToolbar({
  calendars,
  activeCalendarId,
  view,
  cursorDate,
  onCalendarChange,
  onViewChange,
  onToday,
  onMove,
  onCreate,
  onRefresh,
  onExport,
}: {
  calendars: CalendarRecord[];
  activeCalendarId: string;
  view: CalendarView;
  cursorDate: Date;
  onCalendarChange: (calendarId: string) => void;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  onMove: (direction: -1 | 1) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <div className="calendar-toolbar" aria-label="Calendar controls">
      <div className="calendar-toolbar-main">
        <label className="field compact calendar-select">
          <span>Calendar</span>
          <select value={activeCalendarId} onChange={(event) => onCalendarChange(event.target.value)}>
            {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
          </select>
        </label>
        <div className="calendar-date-controls">
          <CommandButton icon={CalendarClock} onClick={onToday}>Today</CommandButton>
          <IconButton icon={ChevronLeft} label="Previous range" onClick={() => onMove(-1)} />
          <strong>{viewTitle(view, cursorDate)}</strong>
          <IconButton icon={ChevronRight} label="Next range" onClick={() => onMove(1)} />
        </div>
      </div>
      <div className="calendar-toolbar-actions">
        <SegmentedControl value={view} onChange={onViewChange} options={viewOptions} label="Calendar view" />
        <CommandButton icon={Plus} onClick={onCreate} primary>New event</CommandButton>
        <CommandButton icon={Download} onClick={onExport}>Export ICS</CommandButton>
        <CommandButton icon={RefreshCw} onClick={onRefresh}>Refresh</CommandButton>
      </div>
    </div>
  );
}
