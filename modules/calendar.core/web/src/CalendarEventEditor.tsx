import { Bell, CalendarPlus, RotateCcw, Trash2 } from "lucide-react";

import { useUokLocalization } from "@uok/shared/localization";
import { ConfirmCommandButton } from "@uok/shared/actions";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { draftWithTimezone } from "./calendarDrafts";
import type { CalendarDraft, CalendarEventRecord, CalendarRecord } from "./calendarTypes";

const recurrenceOptions = [
  ["", "calendar.recurrence.none", "Does not repeat"],
  ["DAILY", "calendar.recurrence.daily", "Daily"],
  ["WEEKLY", "calendar.recurrence.weekly", "Weekly"],
  ["MONTHLY", "calendar.recurrence.monthly", "Monthly"],
  ["YEARLY", "calendar.recurrence.yearly", "Yearly"],
] as const;

export function CalendarEventEditor({
  open,
  draft,
  calendars,
  selectedEvent,
  busyAction,
  error,
  onDraftChange,
  onSave,
  onCancel,
  onClose,
  onRestore,
}: {
  open: boolean;
  draft: CalendarDraft;
  calendars: CalendarRecord[];
  selectedEvent?: CalendarEventRecord;
  busyAction: "" | "save" | "cancel" | "restore";
  error?: string;
  onDraftChange: (draft: CalendarDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
  onRestore: () => void;
}) {
  const { t } = useUokLocalization();
  const canceled = selectedEvent?.status === "canceled";
  const recurring = Boolean(draft.id && draft.recurrenceRule);
  const title = draft.id
    ? recurring ? t("calendar.event.editSeries", "Edit recurring series") : t("calendar.event.edit", "Edit event")
    : t("calendar.event.new", "New event");
  const description = recurring
    ? t("calendar.event.seriesDescription", "Changes, cancellation, and restoration apply to the entire recurring series.")
    : t("calendar.event.editorDescription", "Set the calendar, timing, availability, participants, and recurrence.");
  const working = Boolean(busyAction);

  return (
    <WorkspaceEditorPopup
      open={open}
      label={title}
      title={title}
      description={description}
      onClose={onClose}
      size="wide"
      className="calendar-event-popup"
      dismissible={!working}
    >
      <div className="calendar-event-editor">
        <div className="calendar-editor-fields">
          <label className="field">
            <span>{t("calendar.event.calendar", "Calendar")}</span>
            <select
              value={draft.calendarId}
              onChange={(event) => onDraftChange({ ...draft, calendarId: event.target.value })}
              disabled={Boolean(draft.id) || working}
              required
            >
              {!calendars.length ? <option value="">{t("calendar.selector.none", "No calendars available")}</option> : null}
              {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
            </select>
          </label>
          <label className="field"><span>{t("calendar.event.title", "Title")}</span><input value={draft.title} disabled={working} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} /></label>
          <label className="field"><span>{t("calendar.event.location", "Location")}</span><input value={draft.location} disabled={working} onChange={(event) => onDraftChange({ ...draft, location: event.target.value })} /></label>
          <label className="field"><span>{t("calendar.event.starts", "Starts")}</span><input type="datetime-local" value={draft.startsAt} disabled={working} onChange={(event) => onDraftChange({ ...draft, startsAt: event.target.value, startsAtDirty: true })} /></label>
          <label className="field"><span>{t("calendar.event.ends", "Ends")}</span><input type="datetime-local" value={draft.endsAt} disabled={working} onChange={(event) => onDraftChange({ ...draft, endsAt: event.target.value, endsAtDirty: true })} /></label>
          <label className="field"><span>{t("calendar.event.timezone", "Time zone")}</span><input value={draft.timezone} disabled={working} onChange={(event) => onDraftChange(draftWithTimezone(draft, event.target.value, selectedEvent))} placeholder="America/New_York" /></label>
          <label className="calendar-check"><input type="checkbox" checked={draft.allDay} disabled={working} onChange={(event) => onDraftChange({ ...draft, allDay: event.target.checked })} /> {t("calendar.event.allDay", "All day")}</label>
          <label className="field">
            <span>{t("calendar.event.showAs", "Show as")}</span>
            <select value={draft.transparency} disabled={working} onChange={(event) => onDraftChange({ ...draft, transparency: event.target.value as "busy" | "free" })}>
              <option value="busy">{t("calendar.event.busy", "Busy")}</option>
              <option value="free">{t("calendar.event.free", "Free")}</option>
            </select>
          </label>
          {draft.recurrenceRule.includes(";") && draft.recurrence ? (
            <p className="calendar-editor-note calendar-editor-span">
              {t("calendar.event.advancedRecurrence", "Advanced recurrence details are preserved while the frequency remains unchanged.")}
            </p>
          ) : null}
          <label className="field">
            <span>{t("calendar.event.repeat", "Repeat")}</span>
            <select value={draft.recurrence} disabled={working} onChange={(event) => onDraftChange({ ...draft, recurrence: event.target.value as CalendarDraft["recurrence"] })}>
              {recurrenceOptions.map(([value, key, fallback]) => <option key={value} value={value}>{t(key, fallback)}</option>)}
            </select>
          </label>
          <label className="field"><span>{t("calendar.event.repeatUntil", "Repeat until")}</span><input type="datetime-local" value={draft.recurrenceUntil} disabled={working} onChange={(event) => onDraftChange({ ...draft, recurrenceUntil: event.target.value, recurrenceUntilDirty: true })} /></label>
          {draft.recurrence && !draft.recurrenceUntil ? (
            <p className="calendar-editor-note calendar-editor-span">{t("calendar.event.recurrenceDefaultLimit", "Without a repeat-until date, UOK limits this series to 366 occurrences.")}</p>
          ) : null}
          <label className="field"><span>{t("calendar.event.reminderMinutes", "Reminder minutes")}</span><input type="number" min="0" max="43200" value={draft.reminderMinutes} disabled={working} onChange={(event) => onDraftChange({ ...draft, reminderMinutes: event.target.value })} /></label>
          <label className="field"><span>{t("calendar.event.participantName", "Participant name")}</span><input value={draft.participantName} disabled={working} onChange={(event) => onDraftChange({ ...draft, participantName: event.target.value })} /></label>
          <label className="field"><span>{t("calendar.event.participantEmail", "Participant email")}</span><input value={draft.participantEmail} disabled={working} onChange={(event) => onDraftChange({ ...draft, participantEmail: event.target.value })} /></label>
          <label className="field"><span>{t("calendar.event.description", "Description")}</span><textarea value={draft.description} disabled={working} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} /></label>
        </div>
        {error ? <p className="calendar-editor-error" role="alert" aria-live="assertive">{error}</p> : null}
        {selectedEvent?.reminders?.length ? (
          <p className="calendar-editor-note">
            <Bell size={14} /> {selectedEvent.reminders.length}{" "}
            {selectedEvent.reminders.length === 1
              ? t("calendar.event.savedReminder", "saved reminder")
              : t("calendar.event.savedReminders", "saved reminders")}
            {" — "}{t("calendar.event.reminderDeliveryNote", "calendar export includes alarms; UOK delivery is not enabled yet")}
          </p>
        ) : null}
        <div className="calendar-editor-actions">
          <CommandButton icon={CalendarPlus} onClick={onSave} primary disabled={working || !draft.calendarId} loading={busyAction === "save"}>{draft.id ? t("calendar.event.save", "Save changes") : t("calendar.event.create", "Create event")}</CommandButton>
          {draft.id && !canceled && !recurring ? <CommandButton icon={Trash2} onClick={onCancel} destructive disabled={working} loading={busyAction === "cancel"}>{t("calendar.event.cancel", "Cancel event")}</CommandButton> : null}
          {draft.id && canceled && !recurring ? <CommandButton icon={RotateCcw} onClick={onRestore} disabled={working} loading={busyAction === "restore"}>{t("calendar.event.restore", "Restore event")}</CommandButton> : null}
          {draft.id && !canceled && recurring ? (
            <ConfirmCommandButton
              icon={Trash2}
              message={t("calendar.event.cancelSeriesConfirm", "Cancel this entire recurring series? Every occurrence will be canceled.")}
              onConfirm={onCancel}
              destructive
              disabled={working}
              loading={busyAction === "cancel"}
            >
              {t("calendar.event.cancelSeries", "Cancel series")}
            </ConfirmCommandButton>
          ) : null}
          {draft.id && canceled && recurring ? (
            <ConfirmCommandButton
              icon={RotateCcw}
              message={t("calendar.event.restoreSeriesConfirm", "Restore this entire recurring series? Every occurrence will be restored.")}
              onConfirm={onRestore}
              disabled={working}
              loading={busyAction === "restore"}
            >
              {t("calendar.event.restoreSeries", "Restore series")}
            </ConfirmCommandButton>
          ) : null}
        </div>
      </div>
    </WorkspaceEditorPopup>
  );
}
