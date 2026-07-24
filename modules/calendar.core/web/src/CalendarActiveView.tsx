import { CalendarAgendaView } from "./CalendarAgendaView";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import type { CalendarEventRecord, CalendarView } from "./calendarTypes";

type Props = {
  view: CalendarView;
  cursorDate: Date;
  events: CalendarEventRecord[];
  calendarColors: Record<string, string>;
  selectedEventId?: string;
  onSelectDay: (date: Date, hour?: number) => void;
  onOpenDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
};

export function CalendarActiveView({
  view,
  cursorDate,
  events,
  calendarColors,
  selectedEventId,
  onSelectDay,
  onOpenDay,
  onSelectEvent,
}: Props) {
  if (view === "month") {
    return (
      <CalendarMonthView
        cursorDate={cursorDate}
        events={events}
        calendarColors={calendarColors}
        selectedEventId={selectedEventId}
        onSelectDay={onSelectDay}
        onOpenDay={onOpenDay}
        onSelectEvent={onSelectEvent}
      />
    );
  }
  if (view === "week" || view === "day") {
    return (
      <CalendarTimeGrid
        view={view}
        cursorDate={cursorDate}
        events={events}
        calendarColors={calendarColors}
        selectedEventId={selectedEventId}
        onSelectDay={onSelectDay}
        onSelectEvent={onSelectEvent}
      />
    );
  }
  return (
    <CalendarAgendaView
      events={events}
      calendarColors={calendarColors}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
    />
  );
}
