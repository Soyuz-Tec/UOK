from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def contact_lifecycle_payload(
    identifier: str,
    value: str,
    *,
    reason: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {identifier: value}
    if reason is not None:
        payload["reason"] = reason
    return payload


def private_no_store_headers() -> dict[str, str]:
    return {
        "Cache-Control": "private, no-store",
        "Vary": "Authorization",
    }


def contact_lifecycle_headers(result: Mapping[str, Any]) -> dict[str, str]:
    return {
        "ETag": str(result["etag"]),
        **private_no_store_headers(),
    }
