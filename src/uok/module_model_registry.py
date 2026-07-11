from __future__ import annotations

import inspect as python_inspect
from enum import Enum
from pathlib import Path
from threading import RLock
from types import MappingProxyType
from typing import Any, Mapping

from sqlalchemy import inspect as sqlalchemy_inspect

from .db import Base
from .kernel_models import KERNEL_MODELS
from .module_contract_validation import validate_module_runtime_contracts
from .module_imports import resolve_module_import
from .module_manifest_loader import load_module_manifests
from .module_model_claims import KERNEL_MODEL_NAMES
from .module_order import dependency_order
from .module_paths import repo_root


class ModuleModelRegistryError(RuntimeError):
    """Raised when the validated module model composition cannot be completed."""


class _RegistryState(Enum):
    NEW = "new"
    REGISTERING = "registering"
    READY = "ready"
    FAILED = "failed"


_LOCK = RLock()
_STATE = _RegistryState.NEW
_FAILURE: BaseException | None = None
_MODELS: dict[str, type[Base]] = {}
_MODULE_MODELS: dict[str, dict[str, type[Base]]] = {}
_PROVIDER_ORDER: tuple[str, ...] = ()
_MAPPER_SNAPSHOT: tuple[tuple[str, str, int, str], ...] = ()


def ensure_module_models_registered() -> Mapping[str, type[Base]]:
    """Compose validated module mappings once and return immutable class aliases."""

    global _STATE, _FAILURE
    with _LOCK:
        if _STATE is _RegistryState.READY:
            _assert_registry_unchanged()
            return MappingProxyType(_MODELS)
        if _STATE is _RegistryState.FAILED:
            raise ModuleModelRegistryError(
                "module model registration previously failed; restart the process"
            ) from _FAILURE
        if _STATE is _RegistryState.REGISTERING:
            raise ModuleModelRegistryError("recursive module model registration detected")
        _STATE = _RegistryState.REGISTERING
        try:
            _compose_registry()
        except BaseException as error:
            _FAILURE = error
            _STATE = _RegistryState.FAILED
            if isinstance(error, ModuleModelRegistryError):
                raise
            raise ModuleModelRegistryError(
                f"module model registration failed: {error}"
            ) from error
        _STATE = _RegistryState.READY
        return MappingProxyType(_MODELS)


def module_model_classes() -> Mapping[str, type[Base]]:
    return ensure_module_models_registered()


def module_model_provider_order() -> tuple[str, ...]:
    ensure_module_models_registered()
    return _PROVIDER_ORDER


def module_model_registry_report() -> dict[str, Any]:
    models = ensure_module_models_registered()
    return {
        "ok": True,
        "state": _STATE.value,
        "provider_order": list(_PROVIDER_ORDER),
        "model_count": len(models),
        "table_count": len({model.__table__.name for model in models.values()}),
        "kernel_models": sorted(KERNEL_MODELS),
        "module_models": {
            module_name: {
                name: model.__table__.name
                for name, model in sorted(owned.items())
            }
            for module_name, owned in _MODULE_MODELS.items()
        },
    }


def _compose_registry() -> None:
    global _MODELS, _MODULE_MODELS, _PROVIDER_ORDER, _MAPPER_SNAPSHOT

    if set(KERNEL_MODELS) != set(KERNEL_MODEL_NAMES):
        raise ModuleModelRegistryError(
            "static kernel model claims do not match mapped kernel models"
        )
    contract = validate_module_runtime_contracts()
    if not contract["ok"]:
        raise ModuleModelRegistryError(
            f"module runtime contract is invalid: {contract['violations']}"
        )
    manifests = load_module_manifests()
    ordered_names = dependency_order(manifests)
    provider_names = tuple(
        name for name in ordered_names if manifests[name].get("model_exports")
    )
    registered: dict[str, type[Base]] = dict(KERNEL_MODELS)
    registered_tables = {
        model.__table__.name: name for name, model in registered.items()
    }
    module_models: dict[str, dict[str, type[Base]]] = {}

    for module_name in provider_names:
        manifest = manifests[module_name]
        provider = resolve_module_import(module_name, manifest, "model_exports")
        if not callable(provider):
            raise ModuleModelRegistryError(
                f"module {module_name} model_exports must resolve to a callable"
            )
        exported = provider()
        if type(exported) is not dict:
            raise ModuleModelRegistryError(
                f"module {module_name} model provider must return dict[str, mapped class]"
            )
        expected = {
            str(owner)
            for owner in manifest["owned_tables"]
            if ":" not in str(owner)
        }
        actual = set(exported)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            raise ModuleModelRegistryError(
                f"module {module_name} model provider mismatch; "
                f"missing={missing}, extra={extra}"
            )
        backend = (repo_root() / Path(str(manifest["backend_path"]))).resolve()
        owned: dict[str, type[Base]] = {}
        for model_name, model in sorted(exported.items()):
            _validate_model(module_name, model_name, model, backend)
            if model_name in registered:
                raise ModuleModelRegistryError(
                    f"module {module_name} model {model_name} is already registered"
                )
            table_name = model.__table__.name
            previous = registered_tables.get(table_name)
            if previous is not None:
                raise ModuleModelRegistryError(
                    f"module {module_name} table {table_name} is already mapped by {previous}"
                )
            registered[model_name] = model
            registered_tables[table_name] = model_name
            owned[model_name] = model
        module_models[module_name] = owned

    _validate_complete_mapper_set(registered, manifests, module_models)
    _MODELS = registered
    _MODULE_MODELS = module_models
    _PROVIDER_ORDER = provider_names
    _MAPPER_SNAPSHOT = _current_mapper_snapshot()


def _validate_model(
    module_name: str,
    model_name: str,
    model: object,
    backend: Path,
) -> None:
    if not isinstance(model_name, str) or not model_name:
        raise ModuleModelRegistryError(
            f"module {module_name} model provider returned an invalid key"
        )
    if not isinstance(model, type) or not issubclass(model, Base):
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} must inherit uok.db.Base"
        )
    if model.__name__ != model_name:
        raise ModuleModelRegistryError(
            f"module {module_name} model key {model_name} does not match {model.__name__}"
        )
    mapper = sqlalchemy_inspect(model, raiseerr=False)
    if mapper is None or getattr(mapper, "class_", None) is not model:
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} is not SQLAlchemy mapped"
        )
    if getattr(mapper, "registry", None) is not Base.registry:
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} uses a different mapper registry"
        )
    if model.__table__.metadata is not Base.metadata:
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} uses different metadata"
        )
    source = python_inspect.getsourcefile(model)
    if not source:
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} has no source origin"
        )
    try:
        Path(source).resolve().relative_to(backend)
    except ValueError as error:
        raise ModuleModelRegistryError(
            f"module {module_name} model {model_name} is defined outside its backend"
        ) from error


def _validate_complete_mapper_set(
    registered: dict[str, type[Base]],
    manifests: dict[str, dict[str, Any]],
    module_models: dict[str, dict[str, type[Base]]],
) -> None:
    expected_classes = set(registered.values())
    mapped_classes = {mapper.class_ for mapper in Base.registry.mappers}
    if mapped_classes != expected_classes:
        unexpected = sorted(
            f"{model.__module__}.{model.__name__}"
            for model in mapped_classes - expected_classes
        )
        missing = sorted(
            f"{model.__module__}.{model.__name__}"
            for model in expected_classes - mapped_classes
        )
        raise ModuleModelRegistryError(
            f"mapper registry does not match declared model providers; "
            f"missing={missing}, unexpected={unexpected}"
        )

    for module_name, manifest in manifests.items():
        backend = (repo_root() / Path(str(manifest["backend_path"]))).resolve()
        provided = set(module_models.get(module_name, {}).values())
        hidden: list[str] = []
        for mapped in mapped_classes:
            source = python_inspect.getsourcefile(mapped)
            if not source:
                continue
            try:
                Path(source).resolve().relative_to(backend)
            except ValueError:
                continue
            if mapped not in provided:
                hidden.append(mapped.__name__)
        if hidden:
            raise ModuleModelRegistryError(
                f"module {module_name} omits mapped classes from model_exports: "
                f"{', '.join(sorted(hidden))}"
            )


def _current_mapper_snapshot() -> tuple[tuple[str, str, int, str], ...]:
    return tuple(
        sorted(
            (
                mapper.class_.__module__,
                mapper.class_.__name__,
                id(mapper.class_),
                mapper.local_table.name,
            )
            for mapper in Base.registry.mappers
        )
    )


def _assert_registry_unchanged() -> None:
    if _current_mapper_snapshot() != _MAPPER_SNAPSHOT:
        raise ModuleModelRegistryError(
            "SQLAlchemy mapper registry changed after module model registration"
        )


__all__ = [
    "ModuleModelRegistryError",
    "ensure_module_models_registered",
    "module_model_classes",
    "module_model_provider_order",
    "module_model_registry_report",
]
