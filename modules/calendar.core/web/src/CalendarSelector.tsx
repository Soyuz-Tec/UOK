import { CalendarDays, CalendarPlus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ExpandableControlPanel } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { ConfirmCommandButton } from "@uok/shared/actions";
import { CommandButton } from "@uok/shared/primitives";
import { calendarSwatchStyle } from "./calendarPresentation";
import type { CalendarRecord } from "./calendarTypes";

export function CalendarSelector({
  calendars,
  deletedCalendars = [],
  scopeId,
  onScopeChange,
  onCreateCalendar,
  onDeleteCalendar,
  onRestoreCalendar,
  canCreateCalendar = true,
  canDeleteCalendar = false,
  canRestoreCalendar = false,
  busyAction = "",
}: {
  calendars: CalendarRecord[];
  deletedCalendars?: CalendarRecord[];
  scopeId: string;
  onScopeChange: (calendarId: string) => void;
  onCreateCalendar: () => void;
  onDeleteCalendar?: (calendar: CalendarRecord) => Promise<void> | void;
  onRestoreCalendar?: (calendar: CalendarRecord) => Promise<void> | void;
  canCreateCalendar?: boolean;
  canDeleteCalendar?: boolean;
  canRestoreCalendar?: boolean;
  busyAction?: string;
}) {
  const { t } = useUokLocalization();
  const selectorRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = calendars.find((calendar) => calendar.id === scopeId);
  const selectionIdentity = `${scopeId}:${selected?.status || "missing"}`;
  const previousSelectionRef = useRef(selectionIdentity);
  const selectedLabel = scopeId
    ? selected?.name ?? t("calendar.selector.none", "No calendars available")
    : t("calendar.selector.all", "All calendars");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized
      ? calendars.filter((calendar) => `${calendar.name} ${calendar.timezone}`.toLocaleLowerCase().includes(normalized))
      : calendars;
    return selected && !matches.some((calendar) => calendar.id === selected.id)
      ? [selected, ...matches]
      : matches;
  }, [calendars, query, selected]);

  const closeAndRun = (close: () => void, action: () => void) => {
    close();
    queueMicrotask(action);
  };

  const finishLifecycle = () => {
    setMenuOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => {
      selectorRef.current?.querySelector<HTMLButtonElement>(".expandable-control-trigger")?.focus();
    });
  };

  const runLifecycle = async (operation: (() => Promise<void> | void) | undefined) => {
    if (!operation) throw new Error(t("calendar.selector.unavailable", "This Calendar action is unavailable."));
    await operation();
    finishLifecycle();
  };

  useEffect(() => {
    const previous = previousSelectionRef.current;
    previousSelectionRef.current = selectionIdentity;
    if (!menuOpen || previous === selectionIdentity) return undefined;
    let focusFrame = 0;
    const settleFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        selectorRef.current?.querySelector<HTMLButtonElement>(".expandable-control-trigger")?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [menuOpen, selectionIdentity]);

  return (
    <section ref={selectorRef} className="calendar-selector" aria-label={t("calendar.selector.label", "Calendars")}>
      <ExpandableControlPanel
        className="calendar-selector-menu"
        panelClassName="calendar-selector-panel"
        label={t("calendar.selector.label", "Calendars")}
        triggerIcon={CalendarDays}
        triggerLabel={`${t("calendar.selector.display", "Calendar display")}: ${selectedLabel}`}
        triggerSummary={(
          <span className="calendar-selector-current" title={selectedLabel}>
            {selected ? <span className="calendar-color-dot" style={calendarSwatchStyle(selected.color)} aria-hidden="true" /> : null}
            <span>{selectedLabel}</span>
          </span>
        )}
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setQuery("");
        }}
      >
        {({ close }) => menuOpen ? (
          <div className="calendar-selector-panel-content">
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
            <div className="calendar-list" role="radiogroup" aria-label={t("calendar.selector.display", "Calendar display")}>
              <CalendarScopeRow
                checked={scopeId === ""}
                label={t("calendar.selector.all", "All calendars")}
                description={t("calendar.selector.overlay", "Overlay every visible calendar")}
                onChange={() => closeAndRun(close, () => onScopeChange(""))}
              />
              {filtered.map((calendar) => (
                <CalendarScopeRow
                  key={calendar.id}
                  checked={scopeId === calendar.id}
                  label={calendar.name}
                  description={calendar.timezone}
                  color={calendar.color}
                  onChange={() => closeAndRun(close, () => onScopeChange(calendar.id))}
                />
              ))}
              {!filtered.length ? <p className="calendar-selector-empty">{t("calendar.selector.empty", "No matching calendars")}</p> : null}
            </div>
            {deletedCalendars.length ? (
              <section className="calendar-deleted-list" aria-label={t("calendar.selector.deleted", "Deleted calendars")}>
                <div className="calendar-deleted-heading">
                  <h4>{t("calendar.selector.deleted", "Deleted calendars")}</h4>
                  <span>{deletedCalendars.length}</span>
                </div>
                {deletedCalendars.map((calendar) => (
                  <div className="calendar-deleted-row" key={`${calendar.id}:${calendar.status}`}>
                    <span>
                      <strong>{calendar.name}</strong>
                      <small>{calendar.timezone}</small>
                    </span>
                    <ConfirmCommandButton
                      key={`${calendar.id}:${calendar.status}:restore`}
                      icon={RotateCcw}
                      message={t("calendar.selector.restoreQuestion", "Restore “{name}”? Its retained events, participants, and reminders will return to active Calendar reads.").replace("{name}", calendar.name)}
                      dialogLabel={t("calendar.selector.restore", "Restore calendar")}
                      title={t("calendar.selector.restore", "Restore calendar")}
                      confirmLabel={t("calendar.selector.restore", "Restore calendar")}
                      onConfirm={() => runLifecycle(() => onRestoreCalendar?.(calendar))}
                      disabled={!canRestoreCalendar || calendar.user_managed !== true || calendar.can_restore !== true || Boolean(busyAction)}
                      loading={busyAction === `restore:${calendar.id}`}
                      loadingLabel={t("calendar.selector.restoring", "Restoring calendar")}
                    >
                      {`${t("calendar.selector.restore", "Restore calendar")}: ${calendar.name}`}
                    </ConfirmCommandButton>
                  </div>
                ))}
              </section>
            ) : null}
            <div className="calendar-selector-actions">
              {selected?.user_managed === true ? (
                <ConfirmCommandButton
                  key={`${selected.id}:${selected.status}:delete`}
                  icon={Trash2}
                  message={t("calendar.selector.deleteQuestion", "Delete “{name}”? Its events, participants, and reminders will be hidden but retained for audit, and authorized users can restore it from Deleted calendars.").replace("{name}", selected.name)}
                  dialogLabel={t("calendar.selector.delete", "Delete calendar")}
                  title={t("calendar.selector.delete", "Delete calendar")}
                  confirmLabel={t("calendar.selector.delete", "Delete calendar")}
                  onConfirm={() => runLifecycle(() => onDeleteCalendar?.(selected))}
                  disabled={!canDeleteCalendar || selected.can_delete !== true || Boolean(busyAction)}
                  loading={busyAction === `delete:${selected.id}`}
                  loadingLabel={t("calendar.selector.deleting", "Deleting calendar")}
                  destructive
                >
                  {t("calendar.selector.delete", "Delete calendar")}
                </ConfirmCommandButton>
              ) : null}
              <CommandButton
                icon={CalendarPlus}
                onClick={() => closeAndRun(close, onCreateCalendar)}
                disabled={!canCreateCalendar || Boolean(busyAction)}
                loading={busyAction === "create"}
                loadingLabel={t("calendar.selector.creating", "Creating calendar")}
              >
                {t("calendar.selector.new", "New calendar")}
              </CommandButton>
            </div>
            {selected && selected.user_managed !== true ? (
              <p className="calendar-selector-governance" role="note">{t("calendar.selector.systemManaged", "This Calendar is system-managed and cannot be deleted here.")}</p>
            ) : null}
          </div>
        ) : null}
      </ExpandableControlPanel>
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
