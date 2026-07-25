from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
for import_root in (REPO_ROOT / "tests", REPO_ROOT / "scripts"):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

import engineering_measurements  # noqa: E402
from engineering_measurement_test_support import (  # noqa: E402
    OBSERVED_AT,
    create_measurement_repo,
    git,
)


@pytest.fixture
def measurement_repo(tmp_path: Path) -> Path:
    return create_measurement_repo(tmp_path, engineering_measurements.SOURCE_SPECS)


def test_builder_binds_clean_head_and_derives_coverage(
    measurement_repo: Path,
) -> None:
    payload = engineering_measurements.build_measurements(
        measurement_repo,
        observed_at=OBSERVED_AT,
    )
    coverage = payload["categories"]["test_coverage"]

    assert payload["schema"] == "uok.engineering_measurements.v2"
    assert payload["repository"]["head"] == git(
        measurement_repo,
        "rev-parse",
        "HEAD",
    )
    assert coverage["method"] == "coverage_combined_v2"
    assert [source["path"] for source in coverage["sources"]] == [
        engineering_measurements.SOURCE_SPECS[0][1],
        engineering_measurements.SOURCE_SPECS[1][1],
    ]
    assert all(
        source["media_type"] == "application/json" for source in coverage["sources"]
    )
    assert [source["path"] for source in coverage["provenance"]] == [
        engineering_measurements.PROVENANCE_SPECS[0][1],
        engineering_measurements.PROVENANCE_SPECS[1][1],
    ]
    assert coverage["metrics"]["python"]["inventory"]["file_count"] == 2
    assert coverage["metrics"]["frontend"]["inventory"]["file_count"] == 2
    assert coverage["metrics"]["combined"]["lines"] == {"covered": 17, "total": 20}
    assert coverage["metrics"]["combined"]["branches"] == {"covered": 7, "total": 10}
    assert engineering_measurements.coverage_score(coverage["metrics"]) == 78
    assert "score" not in coverage
    assert payload["categories"]["runtime_efficiency"]["status"] == "unavailable"
    assert (
        "latency, throughput" in payload["categories"]["runtime_efficiency"]["reason"]
    )
    assert payload["categories"]["security_and_supply_chain"]["status"] == "unavailable"
    assert payload["categories"]["ci_and_release_readiness"]["status"] == "unavailable"
    assert (
        engineering_measurements.validate_measurements(payload, measurement_repo)
        == payload
    )


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        (lambda value: value.update({"unexpected": True}), "keys must be exactly"),
        (
            lambda value: value["categories"].update({"invented": {}}),
            "measurement categories keys",
        ),
        (
            lambda value: value["categories"]["test_coverage"].update({"score": 100}),
            "test_coverage measurement keys",
        ),
        (
            lambda value: value["categories"]["test_coverage"].update(
                {"method": "claimed"}
            ),
            "registered method",
        ),
        (
            lambda value: value.update({"observed_at": "2026-07-24T20:00:00"}),
            "timezone offset",
        ),
        (
            lambda value: value["repository"].update({"head": "f" * 40}),
            "repository binding",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["sources"][0].update(
                {"path": "../coverage.json"}
            ),
            "source metadata",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["sources"][0].update(
                {"sha256": "0" * 64}
            ),
            "source metadata",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["sources"][0].update(
                {"bytes": True}
            ),
            "bytes",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["sources"][0].update(
                {"media_type": "text/plain"}
            ),
            "media_type",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["provenance"][0].update(
                {"sha256": "0" * 64}
            ),
            "source metadata",
        ),
        (
            lambda value: value["categories"]["test_coverage"]["metrics"].pop(
                "combined"
            ),
            "coverage metrics keys",
        ),
        (
            lambda value: value["categories"]["security_and_supply_chain"].update(
                {"status": "measured"}
            ),
            "must remain unavailable",
        ),
        (
            lambda value: value["categories"]["runtime_efficiency"].update(
                {"status": "measured"}
            ),
            "must remain unavailable",
        ),
    ],
)
def test_validator_rejects_untrusted_measurement_fields(
    measurement_repo: Path,
    mutation: object,
    match: str,
) -> None:
    payload = engineering_measurements.build_measurements(
        measurement_repo,
        observed_at=OBSERVED_AT,
    )
    tampered = copy.deepcopy(payload)
    mutation(tampered)  # type: ignore[operator]

    with pytest.raises(
        engineering_measurements.MeasurementValidationError,
        match=match,
    ):
        engineering_measurements.validate_measurements(tampered, measurement_repo)
