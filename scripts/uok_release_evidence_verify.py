from __future__ import annotations

from pathlib import Path
from typing import Any

from uok_release_evidence_common import (
    CHECKSUM_PATTERN,
    CHECKSUMS_NAME,
    DIGEST_PATTERN,
    MANIFEST_NAME,
    ReleaseEvidenceError,
    load_json,
    release_controls,
    sha256_file,
    validate_repository_identity,
)


def verify_release_evidence(directory: Path) -> dict[str, Any]:
    directory = directory.resolve()
    manifest = load_json(directory / MANIFEST_NAME)
    if manifest.get("schema") != "uok.release_manifest.v1":
        raise ReleaseEvidenceError("Release manifest schema is not supported")
    if manifest.get("tag") != f"UOK-{manifest.get('version', '')}":
        raise ReleaseEvidenceError("Release manifest tag and version do not match")
    image = manifest.get("image", {})
    validate_repository_identity(
        github_repository=str(manifest.get("github_repository", "")),
        image_repository=str(image.get("repository", "")),
    )
    if image.get("reference") != f"{image.get('repository')}@{image.get('digest')}":
        raise ReleaseEvidenceError("Release manifest image reference is inconsistent")
    if image.get("published_tag") != (
        f"{image.get('repository')}:{manifest.get('version')}"
    ):
        raise ReleaseEvidenceError("Release manifest published tag is inconsistent")
    if not DIGEST_PATTERN.fullmatch(str(image.get("digest", ""))):
        raise ReleaseEvidenceError("Release manifest image digest is invalid")
    if not DIGEST_PATTERN.fullmatch(str(image.get("config_digest", ""))):
        raise ReleaseEvidenceError(
            "Release manifest image configuration digest is invalid"
        )
    if manifest.get("release_controls") != release_controls():
        raise ReleaseEvidenceError(
            "Release manifest controls are incomplete or inconsistent"
        )

    checksums: dict[str, str] = {}
    try:
        lines = (directory / CHECKSUMS_NAME).read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ReleaseEvidenceError(f"Cannot read {CHECKSUMS_NAME}") from exc
    for line in lines:
        match = CHECKSUM_PATTERN.fullmatch(line)
        if match is None or match.group("name") in checksums:
            raise ReleaseEvidenceError(f"Invalid or duplicate checksum line: {line!r}")
        checksums[match.group("name")] = match.group("digest")
    expected_names = {
        path.name
        for path in directory.iterdir()
        if path.is_file() and path.name != CHECKSUMS_NAME
    }
    if checksums.keys() != expected_names:
        raise ReleaseEvidenceError(
            "SHA256SUMS does not cover the exact release file set"
        )
    for name, expected_digest in checksums.items():
        if sha256_file(directory / name) != expected_digest:
            raise ReleaseEvidenceError(f"Checksum mismatch for {name}")
    for artifact in manifest.get("artifacts", []):
        path = directory / artifact["filename"]
        if not path.is_file() or sha256_file(path) != artifact["sha256"]:
            raise ReleaseEvidenceError(f"Manifest artifact mismatch for {path.name}")
    return manifest
