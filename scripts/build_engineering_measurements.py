from __future__ import annotations

import argparse
import json
from pathlib import Path

import engineering_measurements


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "var"
    / "evidence"
    / "engineering"
    / "uok_engineering_measurements_v2.json"
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build verified local UOK line and branch coverage evidence."
    )
    parser.add_argument("--observed-at", help="Timezone-aware ISO-8601 observation time.")
    parser.add_argument("--output", help="Output path under var/evidence by default.")
    parser.add_argument("--stdout", action="store_true")
    args = parser.parse_args()
    try:
        payload = engineering_measurements.build_measurements(
            REPO_ROOT,
            observed_at=args.observed_at,
        )
    except engineering_measurements.MeasurementValidationError as exc:
        parser.error(str(exc))
    rendered = json.dumps(payload, indent=2, allow_nan=False)
    if args.stdout:
        print(rendered)
        return 0
    output = Path(args.output) if args.output else DEFAULT_OUTPUT
    if not output.is_absolute():
        output = REPO_ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
