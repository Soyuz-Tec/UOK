from __future__ import annotations

import argparse
from pathlib import Path

from uok_release_workflow_policy import (
    validate_release_policy,
    validate_release_policy_text,
)

__all__ = ["validate_release_policy", "validate_release_policy_text"]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Structurally validate the UOK immutable-release workflow policy."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()
    problems = validate_release_policy(args.root.resolve())
    if problems:
        for problem in problems:
            print(f"release-policy: {problem}")
        raise SystemExit(1)
    print("UOK immutable-release workflow policy passed.")


if __name__ == "__main__":
    main()
