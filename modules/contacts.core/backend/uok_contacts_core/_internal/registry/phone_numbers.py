from __future__ import annotations

from typing import Any

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat

DEFAULT_PHONE_REGION = "US"


def normalize_phone(value: Any, default_region: str = DEFAULT_PHONE_REGION) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        parsed = phonenumbers.parse(raw, None if raw.startswith("+") else default_region)
    except NumberParseException:
        return raw
    if phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed):
        return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
    return raw
