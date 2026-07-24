from __future__ import annotations

from datetime import date, timedelta
import re
from typing import Annotated

from pydantic import BeforeValidator

EVALUATION_TIMEZONE = "UTC"
EXPIRING_SOON_HORIZON_DAYS = 30
_LATEST_SUPPORTED_AS_OF = date.max - timedelta(days=EXPIRING_SOON_HORIZON_DAYS)
_ISO_DATE_ONLY = re.compile(r"\d{4}-\d{2}-\d{2}\Z")


def _exact_date(value: object) -> object:
    if not isinstance(value, str) or _ISO_DATE_ONLY.fullmatch(value) is None:
        raise ValueError("as_of must use exact YYYY-MM-DD date-only form")
    return value


ExactDateOnly = Annotated[date, BeforeValidator(_exact_date)]


def expiring_soon_through(as_of: date) -> date:
    """Return the inclusive end of the fixed Shipment expiry review window."""
    if as_of > _LATEST_SUPPORTED_AS_OF:
        raise ValueError(
            "as_of must leave room for the 30-day expiry review horizon"
        )
    return as_of + timedelta(days=EXPIRING_SOON_HORIZON_DAYS)


__all__ = [
    "EVALUATION_TIMEZONE",
    "EXPIRING_SOON_HORIZON_DAYS",
    "ExactDateOnly",
    "expiring_soon_through",
]
