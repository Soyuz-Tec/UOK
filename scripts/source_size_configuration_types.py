from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date


CONFIG_SCHEMA = "uok.source_size_policy.v1"
ISSUE_PATTERN = re.compile(r"https://github\.com/Soyuz-Tec/UOK/issues/[1-9][0-9]*\Z")
OWNER_PATTERN = re.compile(r"@[A-Za-z0-9][A-Za-z0-9-]*(?:/[A-Za-z0-9_.-]+)?\Z")
MAX_EXCEPTION_DAYS = 90


class SourceSizeConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class BaselineEntry:
    identity: str
    max_lines: int


@dataclass(frozen=True)
class SizeException:
    identity: str
    kind: str
    path: str
    symbol: str | None
    max_lines: int
    owner: str
    reason: str
    issue: str
    expires_on: date


@dataclass(frozen=True)
class SourceSizeConfiguration:
    baseline: tuple[BaselineEntry, ...]
    exceptions: tuple[SizeException, ...]
