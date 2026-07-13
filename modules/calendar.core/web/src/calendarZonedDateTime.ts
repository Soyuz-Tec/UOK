type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type ZonedInputIssue = "invalid_timezone" | "invalid_input" | "nonexistent" | "ambiguous";
export type ZonedInputResult = { ok: true; date: Date } | { ok: false; issue: ZonedInputIssue };

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidIanaTimeZone(timeZone: string) {
  if (!timeZone.trim()) return false;
  try {
    formatterFor(timeZone).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function zonedInputValue(value: Date | string, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf()) || !isValidIanaTimeZone(timeZone)) return "";
  const wall = wallTimeAt(date, timeZone);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function resolveZonedInput(
  value: string,
  timeZone: string,
  canonical?: string | null,
  canonicalTimeZone?: string | null,
): ZonedInputResult {
  if (!isValidIanaTimeZone(timeZone)) return { ok: false, issue: "invalid_timezone" };
  const wall = parseWallTime(value);
  if (!wall) return { ok: false, issue: "invalid_input" };

  if (canonical && canonicalTimeZone && sameTimeZone(timeZone, canonicalTimeZone)) {
    const canonicalDate = new Date(canonical);
    if (Number.isFinite(canonicalDate.valueOf()) && zonedInputValue(canonicalDate, canonicalTimeZone) === minuteInputValue(wall)) {
      return { ok: true, date: canonicalDate };
    }
  }

  const wallEpoch = wallTimeEpoch(wall);
  const offsets = possibleOffsets(wallEpoch, timeZone);
  const matches = [...offsets]
    .map((offset) => new Date(wallEpoch - offset))
    .filter((candidate) => sameWallTime(wallTimeAt(candidate, timeZone), wall));
  const unique = [...new Map(matches.map((date) => [date.valueOf(), date])).values()];
  if (!unique.length) return { ok: false, issue: "nonexistent" };
  if (unique.length > 1) return { ok: false, issue: "ambiguous" };
  return { ok: true, date: unique[0] };
}

function formatterFor(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function sameTimeZone(left: string, right: string) {
  if (!isValidIanaTimeZone(right)) return false;
  return formatterFor(left).resolvedOptions().timeZone === formatterFor(right).resolvedOptions().timeZone;
}

function wallTimeAt(date: Date, timeZone: string): WallTime {
  const values = Object.fromEntries(
    formatterFor(timeZone).formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: date.getUTCMilliseconds(),
  };
}

function parseWallTime(value: string): WallTime | null {
  const match = INPUT_PATTERN.exec(value);
  if (!match) return null;
  const wall: WallTime = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
    millisecond: Number((match[7] || "").padEnd(3, "0") || 0),
  };
  const date = new Date(wallTimeEpoch(wall));
  return sameWallTime({
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  }, wall) ? wall : null;
}

function wallTimeEpoch(wall: WallTime) {
  const date = new Date(0);
  date.setUTCFullYear(wall.year, wall.month - 1, wall.day);
  date.setUTCHours(wall.hour, wall.minute, wall.second, wall.millisecond);
  return date.valueOf();
}

function possibleOffsets(wallEpoch: number, timeZone: string) {
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = new Date(wallEpoch + hours * 60 * 60 * 1000);
    const wall = wallTimeAt(sample, timeZone);
    offsets.add(wallTimeEpoch(wall) - sample.valueOf());
  }
  return offsets;
}

function sameWallTime(left: WallTime, right: WallTime) {
  return left.year === right.year && left.month === right.month && left.day === right.day
    && left.hour === right.hour && left.minute === right.minute && left.second === right.second
    && left.millisecond === right.millisecond;
}

function minuteInputValue(wall: WallTime) {
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}
