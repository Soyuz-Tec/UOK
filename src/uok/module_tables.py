from __future__ import annotations

from .module_manifest_loader import load_module_manifests
from .models import Base


def _owned_model_name(owner: object) -> str:
    table_or_scope = str(owner).split(":", 1)[0]
    return table_or_scope.split(".", 1)[0]


def model_table_names() -> dict[str, str]:
    return {
        mapper.class_.__name__: mapper.local_table.name
        for mapper in Base.registry.mappers
    }


def declared_module_table_names() -> set[str]:
    tables_by_model = model_table_names()
    table_names: set[str] = set()
    for manifest in load_module_manifests().values():
        for owner in manifest.get("owned_tables", []):
            model_name = _owned_model_name(owner)
            table_name = tables_by_model.get(model_name)
            if table_name:
                table_names.add(table_name)
    return table_names


def undeclared_owned_table_models() -> dict[str, list[str]]:
    tables_by_model = model_table_names()
    missing: dict[str, list[str]] = {}
    for module_name, manifest in load_module_manifests().items():
        for owner in manifest.get("owned_tables", []):
            model_name = _owned_model_name(owner)
            if model_name not in tables_by_model:
                missing.setdefault(module_name, []).append(model_name)
    return missing
