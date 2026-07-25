from __future__ import annotations

from collections.abc import Mapping
from typing import Any


READ_ONLY_TABLES = {"organizations", "users", "schema_versions"}
EXPECTED_DEFAULT_PRIVILEGES = {
    ("public", "uok_owner", "uok_runtime", "r", "DELETE", False),
    ("public", "uok_owner", "uok_runtime", "r", "INSERT", False),
    ("public", "uok_owner", "uok_runtime", "r", "SELECT", False),
    ("public", "uok_owner", "uok_runtime", "r", "UPDATE", False),
    ("public", "uok_owner", "uok_runtime", "S", "SELECT", False),
    ("public", "uok_owner", "uok_runtime", "S", "USAGE", False),
}
EXPECTED_SCHEMA_PRIVILEGES = {
    "schema_name": "public",
    "owner_name": "uok_owner",
    "runtime_can_usage": True,
    "runtime_can_create": False,
    "public_can_usage": False,
    "public_can_create": False,
}


def table_privileges_valid(
    expected_tables: Mapping[str, Mapping[str, Any]],
    privileges: Mapping[str, Mapping[str, Any]],
) -> bool:
    if set(privileges) != set(expected_tables):
        return False
    for table_name, row in privileges.items():
        if row.get("can_select") is not True:
            return False
        if any(
            row.get(field) is not False
            for field in ("can_truncate", "can_references", "can_trigger")
        ):
            return False
        expected_write = table_name not in READ_ONLY_TABLES
        if any(
            row.get(field) is not expected_write
            for field in ("can_insert", "can_update", "can_delete")
        ):
            return False
    return True


def sequence_privileges_valid(rows: list[dict[str, Any]]) -> bool:
    return all(
        row.get("can_usage") is True
        and row.get("can_select") is True
        and row.get("can_update") is False
        for row in rows
    )


def default_privileges_valid(rows: list[dict[str, Any]]) -> bool:
    observed = {
        (
            str(row.get("schema_name")),
            str(row.get("owner_name")),
            str(row.get("grantee_name")),
            str(row.get("object_type")),
            str(row.get("privilege_type")),
            bool(row.get("is_grantable")),
        )
        for row in rows
    }
    return observed == EXPECTED_DEFAULT_PRIVILEGES


def schema_privileges_valid(rows: list[dict[str, Any]]) -> bool:
    return len(rows) == 1 and rows[0] == EXPECTED_SCHEMA_PRIVILEGES


__all__ = [
    "READ_ONLY_TABLES",
    "default_privileges_valid",
    "schema_privileges_valid",
    "sequence_privileges_valid",
    "table_privileges_valid",
]
