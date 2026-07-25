from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_uok_tag_ruleset import (  # noqa: E402
    TagRulesetValidationError,
    validate_tag_ruleset,
)


def _ruleset() -> dict[str, Any]:
    return {
        "id": 19_715_390,
        "name": "UOK immutable release tags",
        "target": "tag",
        "enforcement": "active",
        "conditions": {
            "ref_name": {
                "exclude": [],
                "include": ["refs/tags/UOK-*"],
            }
        },
        "rules": [{"type": "update"}, {"type": "deletion"}],
        "bypass_actors": [],
        "current_user_can_bypass": "never",
    }


def test_exact_release_tag_ruleset_passes() -> None:
    validate_tag_ruleset(_ruleset())


@pytest.mark.parametrize(
    ("path", "replacement"),
    [
        (("id",), 7),
        (("name",), "similar name"),
        (("target",), "branch"),
        (("enforcement",), "evaluate"),
        (("conditions", "ref_name", "include"), ["refs/tags/*"]),
        (("conditions", "ref_name", "exclude"), ["refs/tags/UOK-test"]),
        (("rules",), [{"type": "update"}]),
        (("rules",), [{"type": "update"}, {"type": "deletion"}, {"type": "creation"}]),
        (("bypass_actors",), [{"actor_id": 1}]),
        (("current_user_can_bypass",), "always"),
    ],
)
def test_ruleset_drift_fails_closed(path: tuple[str, ...], replacement: Any) -> None:
    value = _ruleset()
    target: dict[str, Any] = value
    for part in path[:-1]:
        target = target[part]
    target[path[-1]] = copy.deepcopy(replacement)
    with pytest.raises(TagRulesetValidationError):
        validate_tag_ruleset(value)


@pytest.mark.parametrize("hidden_field", ["bypass_actors", "current_user_can_bypass"])
def test_unobservable_protection_fields_fail_closed(hidden_field: str) -> None:
    value = _ruleset()
    del value[hidden_field]
    with pytest.raises(TagRulesetValidationError, match="absent|not observable"):
        validate_tag_ruleset(value)
