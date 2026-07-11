from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from uok.candidate_verifier_catalog import (  # noqa: E402
    CandidateVerifierCatalogError,
    candidate_verifier_catalog,
)


def main() -> int:
    try:
        catalog = candidate_verifier_catalog()
    except (CandidateVerifierCatalogError, ValueError) as error:
        print(f"Candidate verifier catalog invalid: {error}", file=sys.stderr)
        return 2
    print(json.dumps(catalog, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
