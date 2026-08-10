from __future__ import annotations

import argparse


def parse_python_test_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover and run every UOK Python test file in an isolated "
            "sequential subprocess."
        )
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate discovery without running tests.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print the validated test file list.",
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help=(
            "Collect branch coverage without changing per-file subprocess "
            "isolation; write combined reports under "
            "var/evidence/coverage/python."
        ),
    )
    return parser.parse_args()


__all__ = ["parse_python_test_args"]
