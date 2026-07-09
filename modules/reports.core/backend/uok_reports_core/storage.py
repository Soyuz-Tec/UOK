from __future__ import annotations

import os
import re
from pathlib import Path

SAFE_SEGMENT = re.compile(r"[^A-Za-z0-9_.-]+")


def data_dir() -> Path:
    root = Path(os.getenv("DATA_DIR", "./data")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def reports_root() -> Path:
    root = data_dir() / "reports"
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_segment(value: str, fallback: str = "artifact") -> str:
    cleaned = SAFE_SEGMENT.sub("-", value.strip()).strip(".-_")
    return (cleaned or fallback)[:120]


def safe_filename_base(title: str, fallback: str = "uok-report") -> str:
    return safe_segment(title.lower().replace(" ", "-"), fallback=fallback)[:80]


def storage_key_for(organization_id: str, artifact_id: str, extension: str) -> str:
    org = safe_segment(organization_id, "org")
    artifact = safe_segment(artifact_id, "artifact")
    ext = safe_segment(extension, "bin")[:12]
    return f"reports/{org}/{artifact}.{ext}"


def storage_path(storage_key: str) -> Path:
    base = reports_root().resolve()
    candidate = (data_dir() / storage_key).resolve()
    if base != candidate and base not in candidate.parents:
        raise ValueError("report artifact path escaped reports storage root")
    return candidate


def save_report_bytes(organization_id: str, artifact_id: str, extension: str, content: bytes) -> tuple[str, int]:
    storage_key = storage_key_for(organization_id, artifact_id, extension)
    path = storage_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return storage_key, len(content)


def delete_report_file(storage_key: str) -> None:
    path = storage_path(storage_key)
    if path.exists():
        path.unlink()
