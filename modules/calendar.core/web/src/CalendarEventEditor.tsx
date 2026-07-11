import { Bell, CalendarPlus, RotateCcw, Trash2, X } from "lucide-react";

import { CommandButton } from "@uok/shared/primitives";
import type { CalendarDraft, CalendarEventRecord } from "./calendarTypes";

const recurrenceOptions = [
  ["", "Does not repeat"],
  ["DAILY", "Daily"],
  ["WEEKLY", "Weekly"],
  ["MONTHLY", "Monthly"],
  ["YEARLY", "Yearly"],
] as const;

export function CalendarEventEditor({
  draft,
  selectedEvent,
  onDraftChange,
  onSave,
  onCancel,
  onClose,
  onRestore,
}: {
  draft: CalendarDraft;
  selectedEvent?: CalendarEventRecord;
  onDraftChange: (draft: CalendarDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
  onRestore: () => void;
}) {
  const canceled = selectedEvent?.status === "canceled";
  return (
    <aside className="calendar-event-editor" aria-label="Event editor">
      <div className="calendar-editor-header">
        <div>
          <span className="eyebrow">Event</span>
          <h2>{draft.id ? "Edit event" : "New event"}</h2>
        </div>
        <button type="button" className="section-heading-action" aria-label="Close event editor" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="calendar-editor-fields">
        <label className="field"><span>Title</span><input value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} /></label>
        <label className="field"><span>Location</span><input value={draft.location} onChange={(event) => onDraftChange({ ...draft, location: event.target.value })} /></label>
        <label className="field"><span>Starts</span><input type="datetime-local" value={draft.startsAt} onChange={(event) => onDraftChange({ ...draft, startsAt: event.target.value })} /></label>
        <label className="field"><span>Ends</span><input type="datetime-local" value={draft.endsAt} onChange={(event) => onDraftChange({ ...draft, endsAt: event.target.value })} /></label>
        <label className="calendar-check"><input type="checkbox" checked={draft.allDay} onChange={(event) => onDraftChange({ ...draft, allDay: event.target.checked })} /> All day</label>
        <label className="field">
          <span>Show as</span>
          <select value={draft.transparency} onChange={(event) => onDraftChange({ ...draft, transparency: event.target.value as "busy" | "free" })}>
            <option value="busy">Busy</option>
            <option value="free">Free</option>
          </select>
        </label>
        <label className="field">
          <span>Repeat</span>
          <select value={draft.recurrence} onChange={(event) => onDraftChange({ ...draft, recurrence: event.target.value as CalendarDraft["recurrence"] })}>
            {recurrenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field"><span>Repeat until</span><input type="datetime-local" value={draft.recurrenceUntil} onChange={(event) => onDraftChange({ ...draft, recurrenceUntil: event.target.value })} /></label>
        <label className="field"><span>Reminder minutes</span><input type="number" min="0" max="43200" value={draft.reminderMinutes} onChange={(event) => onDraftChange({ ...draft, reminderMinutes: event.target.value })} /></label>
        <label className="field"><span>Participant name</span><input value={draft.participantName} onChange={(event) => onDraftChange({ ...draft, participantName: event.target.value })} /></label>
        <label className="field"><span>Participant email</span><input value={draft.participantEmail} onChange={(event) => onDraftChange({ ...draft, participantEmail: event.target.value })} /></label>
        <label className="field"><span>Description</span><textarea value={draft.description} onChange={(event) => onDraftChange({ ...draft, description: event.target.value })} /></label>
      </div>
      {selectedEvent?.reminders?.length ? <p className="calendar-editor-note"><Bell size={14} /> {selectedEvent.reminders.length} active reminders</p> : null}
      <div className="calendar-editor-actions">
        <CommandButton icon={CalendarPlus} onClick={onSave} primary>{draft.id ? "Save changes" : "Create event"}</CommandButton>
        {draft.id && !canceled ? <CommandButton icon={Trash2} onClick={onCancel} destructive>Cancel event</CommandButton> : null}
        {draft.id && canceled ? <CommandButton icon={RotateCcw} onClick={onRestore}>Restore event</CommandButton> : null}
      </div>
    </aside>
  );
}
