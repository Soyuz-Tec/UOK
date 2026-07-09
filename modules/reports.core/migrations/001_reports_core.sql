-- reports.core
-- Global report artifact metadata. Binary files are stored under DATA_DIR/reports, not in PostgreSQL.

CREATE TABLE IF NOT EXISTS report_artifacts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    source_module TEXT NOT NULL,
    template_key TEXT NOT NULL,
    artifact_kind TEXT NOT NULL DEFAULT 'report',
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    media_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'generated',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);
