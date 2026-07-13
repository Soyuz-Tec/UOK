import { describe, expect, it } from "vitest";

import { draftFromEvent, draftWithTimezone, emptyDraft, eventPayload } from "../../web/src/calendarDrafts";

describe("calendar drafts", () => {
  it("uses the selected wall date and hour for a new event in any draft timezone", () => {
    const selectedDate = new Date(2026, 6, 10, 17, 45);
    expect(emptyDraft(selectedDate, 9, "calendar-1", "America/New_York").startsAt).toBe("2026-07-10T09:00");
    expect(emptyDraft(selectedDate, 9, "calendar-1", "Asia/Tokyo").startsAt).toBe("2026-07-10T09:00");
  });

  it("builds atomic attendee and reminder replacement payloads with explicit clears", () => {
    const payload = eventPayload({
      ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"),
      title: "  Review  ",
      participantName: "Ops",
      participantEmail: "ops@example.test",
      reminderMinutes: "30",
    }, "America/New_York");

    expect(payload).toMatchObject({
      calendar_id: "calendar-1",
      title: "Review",
      description: null,
      location: null,
      recurrence_rule: null,
      recurrence_until: null,
      participants: [{ email: "ops@example.test", display_name: "Ops" }],
      reminders: [{ reminder_type: "in_app", trigger_minutes_before: 30 }],
    });
  });

  it("uses empty arrays to clear attendees and reminders", () => {
    const payload = eventPayload({ ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"), title: "Review" }, "UTC");
    expect(payload.participants).toEqual([]);
    expect(payload.reminders).toEqual([]);
  });

  it("preserves additional attendees and reminders hidden by the compact editor", () => {
    const payload = eventPayload({
      ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1"),
      title: "Review",
      participantName: "Edited first attendee",
      participantEmail: "first-edited@example.test",
      reminderMinutes: "10",
    }, "UTC", {
      id: "event-1",
      calendar_id: "calendar-1",
      title: "Review",
      status: "confirmed",
      occurrence_start: "2026-07-10T13:00:00Z",
      occurrence_end: "2026-07-10T14:00:00Z",
      timezone: "UTC",
      transparency: "busy" as const,
      participants: [
        { participant_type: "person", email: "first@example.test", display_name: "First" },
        { participant_type: "party", participant_id: "party-2", display_name: "Second", response_status: "accepted" },
      ],
      reminders: [
        { id: "reminder-1", reminder_type: "in_app", trigger_minutes_before: 30 },
        { id: "reminder-2", reminder_type: "email", trigger_minutes_before: 60 },
      ],
    });

    expect(payload.participants).toHaveLength(2);
    expect(payload.participants[0]).toMatchObject({ email: "first-edited@example.test", display_name: "Edited first attendee" });
    expect(payload.participants[1]).toMatchObject({ participant_type: "party", participant_id: "party-2", response_status: "accepted" });
    expect(payload.reminders).toEqual([
      { reminder_type: "in_app", trigger_minutes_before: 10 },
      { reminder_type: "email", trigger_minutes_before: 60 },
    ]);
  });

  it("edits the canonical recurring series instead of moving it to the clicked occurrence", () => {
    const event = {
      id: "event-1",
      calendar_id: "calendar-1",
      title: "Weekly review",
      status: "confirmed",
      starts_at: "2026-07-06T13:00:00Z",
      ends_at: "2026-07-06T14:00:00Z",
      occurrence_start: "2026-07-20T13:00:00Z",
      occurrence_end: "2026-07-20T14:00:00Z",
      timezone: "America/New_York",
      transparency: "busy" as const,
      recurrence_rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE",
    };
    const draft = draftFromEvent(event);

    expect(draft.startsAt).toBe("2026-07-06T09:00");
    expect(draft.endsAt).toBe("2026-07-06T10:00");
    const rezonedDraft = draftWithTimezone(draft, "Asia/Kolkata", event);
    expect(rezonedDraft.startsAt).toBe("2026-07-06T18:30");
    const payload = eventPayload(rezonedDraft, "UTC", event);
    expect(payload.timezone).toBe("Asia/Kolkata");
    expect(payload.starts_at).toBe("2026-07-06T13:00:00.000Z");
    expect(payload.ends_at).toBe("2026-07-06T14:00:00.000Z");
    expect(payload.recurrence_rule).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
  });

  it("preserves untouched canonical instants through a daylight-saving fold", () => {
    const event = {
      id: "event-fold", calendar_id: "calendar-1", title: "Fallback review", status: "confirmed",
      starts_at: "2026-11-01T05:30:00Z", ends_at: "2026-11-01T06:30:00Z",
      occurrence_start: "2026-11-01T05:30:00Z", occurrence_end: "2026-11-01T06:30:00Z",
      timezone: "America/New_York", transparency: "busy" as const,
      recurrence_rule: "FREQ=DAILY", recurrence_until: "2026-11-01T06:30:00Z",
    };
    const draft = { ...draftFromEvent(event), title: "Updated fallback review" };

    expect(draft.startsAt).toBe("2026-11-01T01:30");
    expect(draft.endsAt).toBe("2026-11-01T01:30");
    expect(draft.recurrenceUntil).toBe("2026-11-01T01:30");
    const payload = eventPayload(draft, "UTC", event);
    expect(payload.starts_at).toBe("2026-11-01T05:30:00.000Z");
    expect(payload.ends_at).toBe("2026-11-01T06:30:00.000Z");
    expect(payload.recurrence_until).toBe("2026-11-01T06:30:00.000Z");
  });

  it("resolves start, end, and repeat-until wall times in the draft zone", () => {
    const payload = eventPayload({
      ...emptyDraft(new Date(2026, 6, 10), 9, "calendar-1", "Asia/Kolkata"),
      title: "Kolkata series",
      startsAt: "2026-07-10T09:00",
      endsAt: "2026-07-10T10:00",
      recurrence: "DAILY",
      recurrenceUntil: "2026-07-20T09:00",
    }, "UTC");
    expect(payload.starts_at).toBe("2026-07-10T03:30:00.000Z");
    expect(payload.ends_at).toBe("2026-07-10T04:30:00.000Z");
    expect(payload.recurrence_until).toBe("2026-07-20T03:30:00.000Z");
  });

  it("formats and preserves all-day boundaries in the event IANA zone", () => {
    const event = {
      id: "event-all-day",
      calendar_id: "calendar-1",
      title: "New York holiday",
      status: "confirmed",
      starts_at: "2026-07-10T04:00:00Z",
      ends_at: "2026-07-11T04:00:00Z",
      occurrence_start: "2026-07-10T04:00:00Z",
      occurrence_end: "2026-07-11T04:00:00Z",
      timezone: "America/New_York",
      transparency: "free" as const,
      all_day: true,
    };

    const draft = draftFromEvent(event);
    expect(draft.startsAt).toBe("2026-07-10T00:00");
    expect(draft.endsAt).toBe("2026-07-11T00:00");
    const payload = eventPayload(draft, "Asia/Tokyo", event);
    expect(payload.starts_at).toBe("2026-07-10T04:00:00.000Z");
    expect(payload.ends_at).toBe("2026-07-11T04:00:00.000Z");
  });

  it("re-renders only untouched canonical fields after a timezone edit", () => {
    const event = {
      id: "event-1", calendar_id: "calendar-1", title: "Review", status: "confirmed",
      starts_at: "2026-07-10T13:00:00Z", ends_at: "2026-07-10T14:00:00Z",
      occurrence_start: "2026-07-10T13:00:00Z", occurrence_end: "2026-07-10T14:00:00Z",
      timezone: "America/New_York", transparency: "busy" as const,
    };
    const draft = { ...draftFromEvent(event), startsAt: "2026-07-10T08:15", startsAtDirty: true };
    const rezoned = draftWithTimezone(draft, "Asia/Kolkata", event);
    expect(rezoned.startsAt).toBe("2026-07-10T08:15");
    expect(rezoned.endsAt).toBe("2026-07-10T19:30");
  });
});
