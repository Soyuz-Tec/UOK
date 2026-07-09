export type CalendarRecord = {
  id: string;
  name: string;
  color?: string | null;
  status: string;
  timezone: string;
};

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarParticipant = {
  id?: string;
  email?: string | null;
  display_name?: string | null;
  role?: string;
  response_status?: string;
};

export type CalendarReminder = {
  id: string;
  reminder_type: string;
  trigger_minutes_before: number;
};

export type CalendarEventRecord = {
  id: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  status: string;
  starts_at?: string;
  ends_at?: string;
  occurrence_start: string;
  occurrence_end: string;
  timezone: string;
  all_day?: boolean;
  transparency: "busy" | "free" | string;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
  participants?: CalendarParticipant[];
  reminders?: CalendarReminder[];
};

export type CalendarDraft = {
  id?: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  transparency: "busy" | "free";
  recurrence: "" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  recurrenceUntil: string;
  reminderMinutes: string;
  participantName: string;
  participantEmail: string;
};
