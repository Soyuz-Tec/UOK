from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone


MAX_EMAIL_LENGTH = 254
LEGACY_SHA256_LOGIN_MAX_WINDOW = timedelta(days=14)
TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def build_legacy_sha256_login_deadline(
    environment: Mapping[str, str] | None = None,
    *,
    now: datetime | None = None,
) -> datetime | None:
    current = os.environ if environment is None else environment
    raw_flag = current.get("UOK_LEGACY_SHA256_LOGIN_MIGRATION", "0").strip().lower()
    if raw_flag in TRUE_VALUES:
        enabled = True
    elif raw_flag in FALSE_VALUES:
        enabled = False
    else:
        raise RuntimeError("UOK_LEGACY_SHA256_LOGIN_MIGRATION must be a boolean value")
    raw_deadline = current.get("UOK_LEGACY_SHA256_LOGIN_UNTIL", "").strip()
    if not enabled:
        if raw_deadline:
            raise RuntimeError(
                "UOK_LEGACY_SHA256_LOGIN_UNTIL requires the migration flag",
            )
        return None
    if not raw_deadline or not raw_deadline.endswith("Z"):
        raise RuntimeError(
            "UOK_LEGACY_SHA256_LOGIN_UNTIL must be an explicit UTC timestamp"
        )
    try:
        deadline = datetime.fromisoformat(f"{raw_deadline[:-1]}+00:00")
    except ValueError as exc:
        raise RuntimeError(
            "UOK_LEGACY_SHA256_LOGIN_UNTIL must be an explicit UTC timestamp"
        ) from exc
    current_time = now or datetime.now(timezone.utc)
    if deadline <= current_time:
        raise RuntimeError("UOK_LEGACY_SHA256_LOGIN_UNTIL must be in the future")
    if deadline - current_time > LEGACY_SHA256_LOGIN_MAX_WINDOW:
        raise RuntimeError("legacy SHA-256 login migration cannot exceed 14 days")
    return deadline


def normalized_email(value: str) -> str:
    return value.strip().lower()


def is_valid_email(value: str) -> bool:
    if not value or len(value) > MAX_EMAIL_LENGTH:
        return False
    email = normalized_email(value)
    if not email or any(character.isspace() for character in email):
        return False
    local_part, separator, domain = email.partition("@")
    if not local_part or not separator or not domain or "@" in domain:
        return False
    domain_name, dot, top_level_label = domain.rpartition(".")
    return bool(domain_name and dot and top_level_label)
