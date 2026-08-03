from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


RULESET_ID = 19_715_390
RULESET_NAME = "UOK immutable release tags"
RULESET_PATTERN = "refs/tags/UOK-*"
RULE_TYPES = ["deletion", "update"]


class TagRulesetValidationError(RuntimeError):
    """Raised when the release-tag protection is absent, hidden, or incomplete."""


def validate_tag_ruleset(value: Any) -> None:
    if not isinstance(value, dict):
        raise TagRulesetValidationError("Ruleset response must be a JSON object")

    expected_scalars = {
        "id": RULESET_ID,
        "name": RULESET_NAME,
        "target": "tag",
        "enforcement": "active",
        "current_user_can_bypass": "never",
    }
    for field, expected in expected_scalars.items():
        if field not in value:
            raise TagRulesetValidationError(
                f"Ruleset field {field!r} is absent; exact protection is not observable"
            )
        if value[field] != expected:
            raise TagRulesetValidationError(
                f"Ruleset field {field!r} must be {expected!r}, got {value[field]!r}"
            )

    conditions = value.get("conditions")
    ref_name = conditions.get("ref_name") if isinstance(conditions, dict) else None
    if not isinstance(ref_name, dict):
        raise TagRulesetValidationError("Ruleset ref-name conditions are absent")
    if ref_name.get("include") != [RULESET_PATTERN]:
        raise TagRulesetValidationError(
            f"Ruleset include pattern must be exactly {[RULESET_PATTERN]!r}"
        )
    if ref_name.get("exclude") != []:
        raise TagRulesetValidationError("Ruleset exclusions must be empty")

    rules = value.get("rules")
    if not isinstance(rules, list) or any(not isinstance(rule, dict) for rule in rules):
        raise TagRulesetValidationError("Ruleset rules must be a JSON array of objects")
    rule_types = sorted(rule.get("type") for rule in rules)
    if rule_types != RULE_TYPES:
        raise TagRulesetValidationError(
            f"Ruleset rule types must be exactly {RULE_TYPES!r}, got {rule_types!r}"
        )

    if "bypass_actors" not in value:
        raise TagRulesetValidationError(
            "Ruleset bypass actors are not observable; fail closed with a credential "
            "that can read the complete ruleset"
        )
    if value["bypass_actors"] != []:
        raise TagRulesetValidationError("Ruleset bypass actors must be empty")


def load_and_validate(path: Path) -> None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TagRulesetValidationError(f"Cannot parse ruleset JSON: {path}") from exc
    validate_tag_ruleset(value)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fail closed unless UOK release-tag protection exactly matches policy."
    )
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()
    try:
        load_and_validate(args.input)
    except TagRulesetValidationError as exc:
        parser.error(str(exc))
    print(f"UOK release-tag ruleset {RULESET_ID} passed.")


if __name__ == "__main__":
    main()
