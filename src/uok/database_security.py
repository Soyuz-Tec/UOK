from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy import MetaData, Table

from .host.model_registry import (
    ensure_module_models_registered,
    module_model_registry_report,
)
from .kernel.persistence import Base
from .kernel_models import KERNEL_MODELS


SCHEMA = "uok.database_security.v1"
TENANT_CONTEXT_SETTING = "uok.organization_id"
TENANT_POLICY_NAME = "uok_tenant_isolation"
GLOBAL_TABLE_RULES = {
    "organizations": "organization_key",
    "users": "membership_join",
    "schema_versions": "global_readonly",
}
ACTIVATION_BLOCKERS = (
    "trusted request tenant context is not wired before authentication queries",
    "pooled connections do not yet prove transaction-local context cleanup",
    "the login and self-registration paths are not compatible with active RLS",
    "least-privileged production login membership is not yet qualified",
    "RLS is intentionally not enabled or forced by the foundation SQL",
)


def database_security_inventory() -> dict[str, Any]:
    ensure_module_models_registered()
    return inventory_metadata(Base.metadata, table_owners())


def table_owners() -> dict[str, str]:
    owners = {
        model.__table__.name: "kernel"
        for model in KERNEL_MODELS.values()
    }
    registry = module_model_registry_report()
    for module_name, models in registry["module_models"].items():
        for table_name in models.values():
            owners[str(table_name)] = str(module_name)
    return owners


def inventory_metadata(
    metadata: MetaData,
    owners: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    owner_by_table = dict(owners or {})
    rows = [
        _classify_table(table, owner_by_table.get(table.name, "unclaimed"))
        for table in sorted(metadata.tables.values(), key=lambda item: item.name)
    ]
    unclassified = [
        str(row["table"])
        for row in rows
        if row["isolation"] == "unclassified"
    ]
    owner_gaps = [
        str(row["table"])
        for row in rows
        if row["owner"] == "unclaimed"
    ]
    invalid_direct = [
        str(row["table"])
        for row in rows
        if row["isolation"] == "direct"
        and not row["organization_column_valid"]
    ]
    checks = {
        "all_tables_classified": not unclassified,
        "all_tables_have_declared_owner": not owner_gaps,
        "direct_tenant_columns_are_non_null_foreign_keys": not invalid_direct,
        "global_exceptions_are_closed": {
            str(row["table"])
            for row in rows
            if row["isolation"] != "direct"
        } == set(GLOBAL_TABLE_RULES),
    }
    tenant_tables = [
        str(row["table"])
        for row in rows
        if row["isolation"] != "global_readonly"
    ]
    direct_tables = [
        str(row["table"])
        for row in rows
        if row["isolation"] == "direct"
    ]
    return {
        "schema": SCHEMA,
        "ok": all(checks.values()),
        "production_ready": False,
        "tenant_context_setting": TENANT_CONTEXT_SETTING,
        "policy_name": TENANT_POLICY_NAME,
        "checks": checks,
        "counts": {
            "tables": len(rows),
            "tenant_scoped": len(tenant_tables),
            "direct_organization_id": len(direct_tables),
            "global_readonly": len(rows) - len(tenant_tables),
        },
        "tenant_tables": tenant_tables,
        "direct_tables": direct_tables,
        "unclassified_tables": unclassified,
        "owner_gaps": owner_gaps,
        "invalid_direct_tables": invalid_direct,
        "activation_blockers": list(ACTIVATION_BLOCKERS),
        "tables": rows,
    }


def _classify_table(table: Table, owner: str) -> dict[str, Any]:
    if "organization_id" in table.c:
        organization_column = table.c.organization_id
        foreign_targets = sorted(
            foreign_key.target_fullname
            for foreign_key in organization_column.foreign_keys
        )
        isolation = "direct"
        organization_column_valid = (
            not organization_column.nullable
            and foreign_targets == ["organizations.id"]
        )
    else:
        isolation = GLOBAL_TABLE_RULES.get(table.name, "unclassified")
        foreign_targets = []
        organization_column_valid = None
    return {
        "table": table.name,
        "owner": owner,
        "isolation": isolation,
        "tenant_scoped": isolation != "global_readonly",
        "organization_column_valid": organization_column_valid,
        "organization_foreign_keys": foreign_targets,
    }


__all__ = [
    "ACTIVATION_BLOCKERS",
    "GLOBAL_TABLE_RULES",
    "SCHEMA",
    "TENANT_CONTEXT_SETTING",
    "TENANT_POLICY_NAME",
    "database_security_inventory",
    "inventory_metadata",
    "table_owners",
]
