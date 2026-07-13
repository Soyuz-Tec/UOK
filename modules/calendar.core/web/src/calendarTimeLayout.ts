import { addDays, dayKey, eventEnd, eventStart, eventsForDay, startOfDay } from "./calendarDates";
import type { CalendarEventRecord } from "./calendarTypes";

export const MINUTES_PER_DAY = 24 * 60;

export type CalendarTimedSegment = {
  key: string;
  event: CalendarEventRecord;
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
};

export type CalendarDayLayout = {
  allDay: CalendarEventRecord[];
  timed: CalendarTimedSegment[];
};

type RawSegment = Omit<CalendarTimedSegment, "lane" | "laneCount">;

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function rawSegments(events: CalendarEventRecord[], day: Date): RawSegment[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return eventsForDay(events, day)
    .filter((event) => !event.all_day)
    .flatMap((event) => {
      const start = eventStart(event);
      const end = eventEnd(event);
      if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end <= start) return [];
      const startMinute = start <= dayStart ? 0 : minuteOfDay(start);
      const endMinute = end >= dayEnd ? MINUTES_PER_DAY : minuteOfDay(end);
      if (endMinute <= startMinute) return [];
      return [{
        key: `${event.id}-${event.occurrence_start}-${dayKey(dayStart)}`,
        event,
        startMinute,
        endMinute,
      }];
    })
    .sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute || left.key.localeCompare(right.key));
}

function layOutCluster(cluster: RawSegment[]) {
  const laneEnds: number[] = [];
  const placed = cluster.map((segment) => {
    let lane = laneEnds.findIndex((endMinute) => endMinute <= segment.startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = segment.endMinute;
    return { ...segment, lane };
  });
  return placed.map((segment) => ({ ...segment, laneCount: laneEnds.length }));
}

function layOutOverlaps(segments: RawSegment[]) {
  const result: CalendarTimedSegment[] = [];
  let cluster: RawSegment[] = [];
  let clusterEnd = -1;
  for (const segment of segments) {
    if (cluster.length && segment.startMinute >= clusterEnd) {
      result.push(...layOutCluster(cluster));
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(segment);
    clusterEnd = Math.max(clusterEnd, segment.endMinute);
  }
  if (cluster.length) result.push(...layOutCluster(cluster));
  return result;
}

export function layoutCalendarDay(events: CalendarEventRecord[], day: Date): CalendarDayLayout {
  const rows = eventsForDay(events, day);
  return {
    allDay: rows.filter((event) => Boolean(event.all_day)),
    timed: layOutOverlaps(rawSegments(rows, day)),
  };
}
