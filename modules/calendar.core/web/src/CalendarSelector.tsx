import { CalendarPlus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import { calendarSwatchStyle } from "./calendarPresentation";
import type { CalendarRecord } from "./calendarTypes";

export function CalendarSelector({
  calendars,
  scopeId,
  onScopeChange,
  onCreateCalendar,
}: {
  calendars: CalendarRecord[];
  scopeId: string;
  onScopeChange: (calendarId: string) => void;
  onCreateCalendar: () => void;
}) {
  const { t } = useUokLocalization();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? calendars.filter((calendar) => `${calendar.name} ${calendar.timezone}`.toLocaleLowerCase().includes(normalized))
      : calendars;
    const selected = calendars.find((calendar) => calendar.id === scopeId);
    return selected && !matches.some((calendar) => calendar.id === selected.id)
      ? [selected, ...matches]
      : matches;
  }, [calendars, query, scopeId]);

  return (
    <section className="calendar-selector" aria-label={t("calendar.selector.label", "Calendars")}>
      <div className="calendar-selector-heading">
        <h3>{t("calendar.selector.label", "Calendars")}</h3>
        <span>{calendars.length}</span>
      </div>
      <label className="calendar-selector-search">
        <Search size={16} aria-hidden="true" />
        <span className="visually-hidden">{t("calendar.selector.search", "Find calendars")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("calendar.selector.search", "Find calendars")}
        />
      </label>
      <div className="calendar-list" aria-label={t("calendar.selector.display", "Calendar display")}>
        <CalendarScopeRow
          checked={scopeId === ""}
          label={t("calendar.selector.all", "All calendars")}
          description={t("calendar.selector.overlay", "Overlay every visible calendar")}
          onChange={() => onScopeChange("")}
        />
        {filtered.map((calendar) => (
          <CalendarScopeRow
            key={calendar.id}
            checked={scopeId === calendar.id}
            label={calendar.name}
            description={calendar.timezone}
            color={calendar.color}
            onChange={() => onScopeChange(calendar.id)}
          />
        ))}
        {!filtered.length ? <p className="calendar-selector-empty">{t("calendar.selector.empty", "No matching calendars")}</p> : null}
      </div>
      <CommandButton icon={CalendarPlus} onClick={onCreateCalendar}>{t("calendar.selector.new", "New calendar")}</CommandButton>
    </section>
  );
}

function CalendarScopeRow({
  checked,
  label,
  description,
  color,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  color?: string | null;
  onChange: () => void;
}) {
  return (
    <label className={checked ? "calendar-scope-row selected" : "calendar-scope-row"}>
      <input type="radio" name="calendar-display-scope" checked={checked} onChange={onChange} />
      <span className="calendar-color-dot" style={calendarSwatchStyle(color)} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
