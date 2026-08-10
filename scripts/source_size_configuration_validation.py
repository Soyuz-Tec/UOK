from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from source_size_configuration_types import (
    CONFIG_SCHEMA,
    ISSUE_PATTERN,
    MAX_EXCEPTION_DAYS,
    OWNER_PATTERN,
    BaselineEntry,
    SizeException,
    SourceSizeConfiguration,
    SourceSizeConfigurationError,
)
from source_size_rules import (
    HARD_FILE_LINE_LIMIT,
    HARD_FUNCTION_LINE_LIMIT,
    SOFT_FUNCTION_LINE_LIMIT,
    SOURCE_SUFFIXES,
    file_identity,
    function_identity,
    normalized_relative_path,
    soft_file_limit,
)


def _fail(message: str) -> None:
    raise SourceSizeConfigurationError(message)


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            _fail(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _strict_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if type(value) is not dict or set(value) != expected:
        _fail(f"{label} keys must be exactly {sorted(expected)}")
    return value


def _positive_integer(value: Any, label: str) -> int:
    if type(value) is not int or value <= 0:
        _fail(f"{label} must be a positive integer")
    return value


def _validated_path(value: str) -> str:
    try:
        path = normalized_relative_path(value)
    except ValueError as exc:
        _fail(str(exc))
    if PurePosixPath(path).suffix not in SOURCE_SUFFIXES:
        _fail("configured path must use a scanned source suffix")
    return path


def _identity_parts(identity: Any) -> tuple[str, str, str | None]:
    if not isinstance(identity, str) or identity != identity.strip():
        _fail("identity must be a non-empty trimmed string")
    if identity.startswith("file:"):
        path = identity.removeprefix("file:")
        symbol = None
        expected = file_identity(_validated_path(path))
        kind = "file"
    elif identity.startswith("function:") and "::" in identity:
        path, symbol = identity.removeprefix("function:").split("::", 1)
        path = _validated_path(path)
        if not symbol or any(
            part != "<locals>" and not part.isidentifier() for part in symbol.split(".")
        ):
            _fail("function identity must contain a valid qualified symbol")
        expected = function_identity(path, symbol)
        kind = "function"
    else:
        _fail("identity must use file:<path> or function:<path>::<qualified-name>")
    if identity != expected:
        _fail("identity is not canonical")
    return kind, path, symbol


def _baseline_entry(value: Any) -> BaselineEntry:
    item = _strict_keys(value, {"identity", "max_lines"}, "baseline entry")
    identity = item["identity"]
    kind, path, _ = _identity_parts(identity)
    maximum = _positive_integer(item["max_lines"], "baseline max_lines")
    if kind == "function":
        if not SOFT_FUNCTION_LINE_LIMIT < maximum <= HARD_FUNCTION_LINE_LIMIT:
            _fail("function baseline max_lines must be between 61 and 120")
    else:
        threshold = soft_file_limit(path, PurePosixPath(path).suffix)
        if not threshold < maximum <= HARD_FILE_LINE_LIMIT:
            _fail(
                f"file baseline max_lines must be between {threshold + 1} "
                f"and {HARD_FILE_LINE_LIMIT}"
            )
    return BaselineEntry(identity, maximum)


def _exception_fields() -> set[str]:
    return {
        "identity",
        "kind",
        "path",
        "symbol",
        "max_lines",
        "owner",
        "reason",
        "issue",
        "expires_on",
    }


def _validated_expiry(value: Any, today: date) -> date:
    if not isinstance(value, str):
        _fail("exception expires_on must be an ISO date")
    try:
        expires_on = date.fromisoformat(value)
    except ValueError:
        _fail("exception expires_on must be a valid ISO date")
    if value != expires_on.isoformat():
        _fail("exception expires_on must use canonical YYYY-MM-DD form")
    if expires_on < today or expires_on > today + timedelta(days=MAX_EXCEPTION_DAYS):
        _fail("exception expiry must be current and no more than 90 days away")
    return expires_on


def _validated_exception_metadata(
    item: dict[str, Any],
) -> tuple[str, str, str]:
    owner = item["owner"]
    reason = item["reason"]
    issue = item["issue"]
    if not isinstance(owner, str) or OWNER_PATTERN.fullmatch(owner) is None:
        _fail("exception owner must be an exact GitHub owner handle")
    if not isinstance(reason, str) or reason != reason.strip() or len(reason) < 20:
        _fail(
            "exception reason must be a trimmed explanation of at least 20 characters"
        )
    if not isinstance(issue, str) or ISSUE_PATTERN.fullmatch(issue) is None:
        _fail("exception issue must be a full Soyuz-Tec/UOK GitHub issue URL")
    return owner, reason, issue


def _exception_entry(value: Any, today: date) -> SizeException:
    item = _strict_keys(value, _exception_fields(), "exception entry")
    kind, path, symbol = _identity_parts(item["identity"])
    if item["kind"] != kind or item["path"] != path or item["symbol"] != symbol:
        _fail("exception kind, path, and symbol must exactly match its identity")
    maximum = _positive_integer(item["max_lines"], "exception max_lines")
    owner, reason, issue = _validated_exception_metadata(item)
    expires_on = _validated_expiry(item["expires_on"], today)
    return SizeException(
        item["identity"],
        kind,
        path,
        symbol,
        maximum,
        owner,
        reason,
        issue,
        expires_on,
    )


def _ordered_unique(values: list[Any], label: str) -> None:
    identities = [value.identity for value in values]
    if identities != sorted(identities):
        _fail(f"{label} entries must be sorted by identity")
    if len(identities) != len(set(identities)):
        _fail(f"{label} identities must be unique")


def _load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8", errors="strict"),
            object_pairs_hook=_strict_object,
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        _fail(f"cannot read source-size configuration: {exc}")


def load_source_size_configuration(
    path: Path,
    *,
    today: date | None = None,
) -> SourceSizeConfiguration:
    if path.is_symlink():
        _fail("source-size configuration may not be a symlink")
    if not path.is_file():
        _fail(f"source-size configuration is missing: {path}")
    payload = _load_json(path)
    top = _strict_keys(payload, {"schema", "baseline", "exceptions"}, "configuration")
    if top["schema"] != CONFIG_SCHEMA:
        _fail(f"configuration schema must be {CONFIG_SCHEMA}")
    if type(top["baseline"]) is not list or type(top["exceptions"]) is not list:
        _fail("configuration baseline and exceptions must be arrays")
    effective_today = today or datetime.now(UTC).date()
    baseline = [_baseline_entry(value) for value in top["baseline"]]
    exceptions = [
        _exception_entry(value, effective_today) for value in top["exceptions"]
    ]
    _ordered_unique(baseline, "baseline")
    _ordered_unique(exceptions, "exception")
    return SourceSizeConfiguration(tuple(baseline), tuple(exceptions))
