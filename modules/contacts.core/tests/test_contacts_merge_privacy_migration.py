from __future__ import annotations

from pathlib import Path

from sqlalchemy.dialects import postgresql

from uok_contacts_core._internal.registry.read_model_rows import _public_party_attrs
from uok_contacts_core._internal.registry.read_model_search import _postgres_contact_search_vector
from uok_contacts_core._internal.registry.validation import CONTACT_ATTR_FIELDS

PUBLIC_MERGE_FIELDS = {
    "duplicate_party_id",
    "merge_id",
    "merged_at",
    "primary_party_id",
    "rolled_back_at",
}
PRIVATE_MERGE_FIELDS = {
    "duplicate_attrs_before",
    "duplicate_display_name",
    "field_choices",
    "governed_records",
    "groups",
    "notes",
    "primary_attrs_before",
    "relationships",
}


def _migration_text() -> str:
    root = Path(__file__).resolve().parents[3]
    return (root / "modules/contacts.core/migrations/004_contacts_core_merge_privacy.sql").read_text(encoding="utf-8")


def test_merge_privacy_migration_allowlists_history_and_replaces_raw_attrs_search_index() -> None:
    sql = _migration_text()
    sanitation_sql, search_index_sql = sql.split("DROP INDEX IF EXISTS ix_contacts_core_parties_search_vector;", 1)
    assert "jsonb_build_object" in sanitation_sql
    assert "IS DISTINCT FROM sanitized.public_history" in sanitation_sql
    assert all(f"'{field}'" in sanitation_sql for field in PUBLIC_MERGE_FIELDS)
    assert all(field not in sanitation_sql for field in PRIVATE_MERGE_FIELDS)

    assert "CREATE INDEX ix_contacts_core_parties_search_vector" in search_index_sql
    assert "coalesce(attrs_json, '')" not in search_index_sql
    assert "merge_history" not in search_index_sql
    assert all(f"attrs_json::jsonb ->> '{field}'" in search_index_sql for field in CONTACT_ATTR_FIELDS)


def test_postgres_search_vector_extracts_only_explicit_contact_fields() -> None:
    compiled = str(_postgres_contact_search_vector().compile(
        dialect=postgresql.dialect(),
        compile_kwargs={"literal_binds": True},
    ))
    assert "merge_history" not in compiled
    assert "primary_attrs_before" not in compiled
    assert "coalesce(parties.attrs_json, '')" not in compiled
    assert compiled.count("->>") == len(CONTACT_ATTR_FIELDS)
    assert all(f"->> '{field}'" in compiled for field in CONTACT_ATTR_FIELDS)


def test_read_model_strips_private_fields_from_legacy_merge_history() -> None:
    private_item = {
        "merge_id": "merge-1",
        "primary_party_id": "party-primary",
        "duplicate_party_id": "party-duplicate",
        "duplicate_display_name": "Private Person",
        "primary_attrs_before": {"email": "primary@example.test"},
        "duplicate_attrs_before": {"email": "duplicate@example.test"},
        "groups": [{"id": "group-1"}],
        "merged_at": "2026-07-14T12:00:00",
    }
    attrs = _public_party_attrs({"email": "current@example.test", "merge_history": [private_item]})
    assert attrs["email"] == "current@example.test"
    assert attrs["merge_history"] == [{
        "duplicate_party_id": "party-duplicate",
        "merge_id": "merge-1",
        "merged_at": "2026-07-14T12:00:00",
        "primary_party_id": "party-primary",
    }]
    assert not (set(attrs["merge_history"][0]) & PRIVATE_MERGE_FIELDS)
