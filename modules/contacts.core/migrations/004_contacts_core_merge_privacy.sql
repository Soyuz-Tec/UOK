-- UOK-3.1.0-alpha.3
-- contacts.core module migration: remove legacy private merge rollback payloads
-- from Party attrs and replace the raw attrs full-text index with an allowlist.

BEGIN;

WITH candidates AS (
    SELECT id, attrs_json::jsonb AS attrs
    FROM parties
    WHERE attrs_json::jsonb ? 'merge_history'
), sanitized AS (
    SELECT
        id,
        attrs,
        CASE
            WHEN jsonb_typeof(attrs -> 'merge_history') = 'array' THEN COALESCE((
                SELECT jsonb_agg(
                    jsonb_strip_nulls(jsonb_build_object(
                        'merge_id', item -> 'merge_id',
                        'primary_party_id', item -> 'primary_party_id',
                        'duplicate_party_id', item -> 'duplicate_party_id',
                        'merged_at', item -> 'merged_at',
                        'rolled_back_at', item -> 'rolled_back_at'
                    ))
                    ORDER BY position
                )
                FROM jsonb_array_elements(attrs -> 'merge_history')
                    WITH ORDINALITY AS history(item, position)
                WHERE jsonb_typeof(item) = 'object'
            ), '[]'::jsonb)
            ELSE '[]'::jsonb
        END AS public_history
    FROM candidates
)
UPDATE parties AS party
SET attrs_json = jsonb_set(sanitized.attrs, '{merge_history}', sanitized.public_history, true)::text
FROM sanitized
WHERE party.id = sanitized.id
  AND (sanitized.attrs -> 'merge_history') IS DISTINCT FROM sanitized.public_history;

DROP INDEX IF EXISTS ix_contacts_core_parties_search_vector;

CREATE INDEX ix_contacts_core_parties_search_vector
    ON parties USING GIN (
        to_tsvector(
            'simple',
            coalesce(display_name, '') || ' ' ||
            coalesce(party_type, '') || ' ' ||
            coalesce(status, '') || ' ' ||
            coalesce(review_state, '') || ' ' ||
            coalesce(source, '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'given_name', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'family_name', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'organization_name', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'email', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'phone', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'website', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'address', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'title', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'birthday', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'important_date', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'instant_message', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'tags', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'consent_status', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'allowed_use', '') || ' ' ||
            coalesce(attrs_json::jsonb ->> 'confidence_level', '')
        )
    );

COMMIT;
