-- UOK calendar.core
-- Global calendar, event, participant, and reminder tables.

CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    owner_user_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    color TEXT,
    visibility_scope TEXT NOT NULL DEFAULT 'organization',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'active',
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendars_org_status ON calendars(organization_id, status);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    calendar_id TEXT NOT NULL REFERENCES calendars(id),
    uid TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_type TEXT NOT NULL DEFAULT 'event',
    status TEXT NOT NULL DEFAULT 'confirmed',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    all_day BOOLEAN NOT NULL DEFAULT false,
    transparency TEXT NOT NULL DEFAULT 'busy',
    recurrence_rule TEXT,
    recurrence_until TIMESTAMPTZ,
    source_module TEXT,
    source_object_type TEXT,
    source_object_id TEXT,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    canceled_at TIMESTAMPTZ,
    UNIQUE (organization_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_window ON calendar_events(organization_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_window ON calendar_events(calendar_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(organization_id, source_module, source_object_type, source_object_id);

CREATE TABLE IF NOT EXISTS calendar_event_participants (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    event_id TEXT NOT NULL REFERENCES calendar_events(id),
    participant_type TEXT NOT NULL,
    participant_id TEXT,
    email TEXT,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'required',
    response_status TEXT NOT NULL DEFAULT 'needs_action',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_participants_event ON calendar_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_participants_org_participant ON calendar_event_participants(organization_id, participant_type, participant_id);

CREATE TABLE IF NOT EXISTS calendar_reminders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    event_id TEXT NOT NULL REFERENCES calendar_events(id),
    reminder_type TEXT NOT NULL DEFAULT 'in_app',
    trigger_minutes_before INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_event ON calendar_reminders(event_id, status);
