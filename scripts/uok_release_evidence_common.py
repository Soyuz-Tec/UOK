from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any


MANIFEST_NAME = "UOK_RELEASE_MANIFEST.json"
CHECKSUMS_NAME = "SHA256SUMS"
NOTES_NAME = "RELEASE_NOTES.md"
PACKAGE_MANIFEST_NAME = "UOK_PACKAGE_MANIFEST.json"
DIGEST_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")
COMMIT_PATTERN = re.compile(r"[0-9a-f]{40,64}\Z")
SAFE_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,159}\Z")
CHECKSUM_PATTERN = re.compile(
    r"(?P<digest>[0-9a-f]{64})  (?P<name>[A-Za-z0-9][A-Za-z0-9._+-]*)\Z"
)
RELEASE_TAG_RULESET_ID = 19_715_390
RELEASE_TAG_RULESET_NAME = "UOK immutable release tags"
RELEASE_TAG_PATTERN = "refs/tags/UOK-*"


class ReleaseEvidenceError(RuntimeError):
    """Raised when release evidence is incomplete, unsafe, or inconsistent."""


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReleaseEvidenceError(f"Cannot parse JSON evidence {path.name}") from exc


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def release_controls() -> dict[str, Any]:
    return {
        "ghcr": {
            "atomic_create_supported": False,
            "digest_is_authority": True,
            "residual_race": "no_atomic_create_only_tag_publication",
            "tag_immutability_enforced": False,
            "version_tag_is_authority": False,
            "version_tag_role": "discovery_only",
        },
        "git_tag_ruleset": {
            "bypass_actors": [],
            "id": RELEASE_TAG_RULESET_ID,
            "name": RELEASE_TAG_RULESET_NAME,
            "pattern": RELEASE_TAG_PATTERN,
            "protected": True,
            "rules": ["deletion", "update"],
        },
    }
