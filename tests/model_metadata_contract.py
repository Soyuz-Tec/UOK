from __future__ import annotations

from typing import Any, Mapping

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    PrimaryKeyConstraint,
    UniqueConstraint,
)


def normalized_model_metadata(
    models: Mapping[str, type],
) -> dict[str, dict[str, Any]]:
    return {
        name: _table_signature(model.__table__)
        for name, model in sorted(models.items())
    }


def _table_signature(table: Any) -> dict[str, Any]:
    constraints = [_constraint_signature(item) for item in table.constraints]
    constraints.sort(key=_sort_key)
    indexes = [
        [
            index.name,
            index.unique,
            [str(expression) for expression in index.expressions],
            _dialect_options(index),
        ]
        for index in table.indexes
    ]
    indexes.sort(key=_sort_key)
    return {
        "table": table.name,
        "schema": table.schema,
        "columns": [
            [
                column.name,
                str(column.type),
                column.nullable,
                column.primary_key,
                column.autoincrement,
                _default_signature(column.default),
                _server_default_signature(column.server_default),
                sorted(
                    foreign_key.target_fullname for foreign_key in column.foreign_keys
                ),
            ]
            for column in table.columns
        ],
        "constraints": constraints,
        "indexes": indexes,
    }


def _constraint_signature(constraint: Any) -> list[Any]:
    common = [constraint.name, _dialect_options(constraint)]
    if isinstance(constraint, CheckConstraint):
        return ["check", str(constraint.sqltext), *common]
    if isinstance(constraint, ForeignKeyConstraint):
        return [
            "foreign_key",
            [column.name for column in constraint.columns],
            [element.target_fullname for element in constraint.elements],
            constraint.ondelete,
            constraint.onupdate,
            constraint.deferrable,
            constraint.initially,
            *common,
        ]
    if isinstance(constraint, PrimaryKeyConstraint):
        return [
            "primary_key",
            [column.name for column in constraint.columns],
            *common,
        ]
    if isinstance(constraint, UniqueConstraint):
        return ["unique", [column.name for column in constraint.columns], *common]
    return [type(constraint).__name__, *common]


def _default_signature(default: Any) -> str | None:
    if default is None:
        return None
    argument = default.arg
    if default.is_callable:
        return f"callable:{getattr(argument, '__name__', type(argument).__name__)}"
    if default.is_scalar:
        return f"scalar:{argument!r}"
    return f"sql:{argument}"


def _server_default_signature(default: Any) -> str | None:
    if default is None:
        return None
    return str(default.arg)


def _dialect_options(item: Any) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for dialect in sorted(item.dialect_options):
        values = {
            key: repr(value)
            for key, value in sorted(dict(item.dialect_options[dialect]).items())
            if value not in (None, False)
        }
        if values:
            result[dialect] = values
    return result


def _sort_key(value: Any) -> str:
    import json

    return json.dumps(value, sort_keys=True)
