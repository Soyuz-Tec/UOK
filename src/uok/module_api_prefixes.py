from __future__ import annotations

import re
from typing import Any


API_PREFIX_SEGMENT_PATTERN = re.compile(
    r"^[a-z0-9](?:[a-z0-9._~-]*[a-z0-9])?$"
)
CANONICAL_API_PREFIX_REASON = (
    "API prefixes must be canonical safe paths under /api without dot segments, "
    "repeated or trailing separators, query, fragment, backslash, or encoded forms"
)
KERNEL_API_PREFIXES = (
    "/api/architecture",
    "/api/auth",
    "/api/baseline-evidence",
    "/api/commands",
    "/api/dashboard",
    "/api/migrations",
)


def validate_api_prefixes(
    module_name: str,
    prefixes: list[str],
    rows: list[dict[str, str]],
) -> None:
    for prefix in prefixes:
        if not is_canonical_api_prefix(prefix):
            rows.append(
                {
                    "module": module_name,
                    "field": "api_prefixes",
                    "reason": CANONICAL_API_PREFIX_REASON,
                }
            )


def validate_api_prefix_ownership(
    manifests: dict[str, dict[str, Any]],
    rows: list[dict[str, str]],
) -> None:
    owners: list[tuple[str, str]] = []
    for module_name in sorted(manifests):
        for prefix in sorted(manifests[module_name]["api_prefixes"]):
            if not is_canonical_api_prefix(prefix):
                continue
            for kernel_prefix in KERNEL_API_PREFIXES:
                if api_prefixes_overlap(prefix, kernel_prefix):
                    rows.append(
                        {
                            "module": module_name,
                            "field": "api_prefixes",
                            "reason": (
                                f"API prefix {prefix} overlaps kernel-owned "
                                f"prefix {kernel_prefix}"
                            ),
                        }
                    )
            for owned_prefix, owner in owners:
                if api_prefixes_overlap(prefix, owned_prefix):
                    rows.append(
                        {
                            "module": module_name,
                            "field": "api_prefixes",
                            "reason": (
                                f"API prefix {prefix} overlaps {owned_prefix} "
                                f"owned by {owner}"
                            ),
                        }
                    )
            owners.append((prefix, module_name))


def is_canonical_api_prefix(prefix: str) -> bool:
    if not prefix.startswith("/api/") or prefix.endswith("/"):
        return False
    if any(marker in prefix for marker in ("\\", "?", "#", "%")):
        return False
    segments = prefix.split("/")[2:]
    return bool(segments) and all(
        segment not in {".", ".."}
        and API_PREFIX_SEGMENT_PATTERN.fullmatch(segment) is not None
        for segment in segments
    )


def api_prefixes_overlap(left: str, right: str) -> bool:
    return (
        left == right
        or left.startswith(right + "/")
        or right.startswith(left + "/")
    )


def is_canonical_api_route_path(path: str) -> bool:
    if not path.startswith("/") or "//" in path:
        return False
    if any(marker in path for marker in ("\\", "?", "#", "%")):
        return False
    if any(ord(character) < 32 for character in path):
        return False
    return all(segment not in {".", ".."} for segment in path.split("/")[1:])
