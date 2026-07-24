from __future__ import annotations

from pathlib import Path

import pytest

from uok.module_manifest_loader import _parse_manifest_yaml


MANIFEST_PATH = Path("manifest.yaml")


def test_plain_hash_is_preserved_until_a_comment_separation_boundary() -> None:
    parsed = _parse_manifest_yaml(
        """description: Phase#1 module # release note
events:
  - Release#1
  - Release2 # release note
""",
        MANIFEST_PATH,
    )

    assert parsed["description"] == "Phase#1 module"
    assert parsed["events"] == ["Release#1", "Release2"]


def test_supported_quoted_escapes_are_decoded_without_losing_hashes() -> None:
    parsed = _parse_manifest_yaml(
        """description: 'Owner''s #1 module' # release note
data_retention_policy: "A \\"quoted\\" path \\\\root #1" # release note
""",
        MANIFEST_PATH,
    )

    assert parsed["description"] == "Owner's #1 module"
    assert parsed["data_retention_policy"] == 'A "quoted" path \\root #1'


def test_unsupported_double_quoted_escape_fails_deterministically() -> None:
    with pytest.raises(ValueError, match=r"unsupported double-quoted escape \\n"):
        _parse_manifest_yaml(
            'description: "Phase \\n module"\n',
            MANIFEST_PATH,
        )
