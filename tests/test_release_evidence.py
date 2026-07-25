from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from uok_release_evidence import (  # noqa: E402
    CHECKSUMS_NAME,
    MANIFEST_NAME,
    ReleaseEvidenceError,
    create_release_evidence,
    verify_release_evidence,
)


COMMIT = "a" * 40
DIGEST = f"sha256:{'b' * 64}"
CONFIG_DIGEST = f"sha256:{'c' * 64}"


def _write_json(path: Path, value: object) -> Path:
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _inputs(
    root: Path, *, vulnerabilities: list[dict[str, str]] | None = None
) -> dict[str, Path]:
    source = root / "UOK-3.1.0-alpha.3-source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr(
            "UOK_PACKAGE_MANIFEST.json",
            json.dumps(
                {
                    "schema": "uok.source_package_manifest.v1",
                    "source_commit": COMMIT,
                    "version": "3.1.0-alpha.3",
                }
            ),
        )
    return {
        "source_package": source,
        "spdx_sbom": _write_json(root / "uok.spdx.json", {"spdxVersion": "SPDX-2.3"}),
        "cyclonedx_sbom": _write_json(
            root / "uok.cyclonedx.json",
            {"bomFormat": "CycloneDX", "specVersion": "1.6"},
        ),
        "vulnerability_report": _write_json(
            root / "uok-trivy.json",
            {
                "ArtifactType": "container_image",
                "Metadata": {"ImageID": CONFIG_DIGEST},
                "SchemaVersion": 2,
                "Results": [{"Vulnerabilities": vulnerabilities or []}],
            },
        ),
    }


def _create(root: Path, **inputs: Path) -> None:
    create_release_evidence(
        output_directory=root,
        tag="UOK-3.1.0-alpha.3",
        version="3.1.0-alpha.3",
        source_commit=COMMIT,
        github_repository="Soyuz-Tec/UOK",
        image_repository="ghcr.io/soyuz-tec/uok",
        image_digest=DIGEST,
        image_config_digest=CONFIG_DIGEST,
        **inputs,
    )


def test_release_evidence_binds_digest_artifacts_checksums_and_rollback(
    tmp_path: Path,
) -> None:
    _create(tmp_path, **_inputs(tmp_path))

    manifest = verify_release_evidence(tmp_path)
    assert manifest["image"]["reference"] == f"ghcr.io/soyuz-tec/uok@{DIGEST}"
    assert manifest["image"]["config_digest"] == CONFIG_DIGEST
    assert manifest["rollback"] == {
        "deployment_by_mutable_tag_permitted": False,
        "previous_approved_digest_required": True,
        "strategy": "redeploy_previous_approved_digest",
    }
    assert manifest["release_controls"]["git_tag_ruleset"]["id"] == 19_715_390
    assert manifest["release_controls"]["ghcr"] == {
        "atomic_create_supported": False,
        "digest_is_authority": True,
        "residual_race": "no_atomic_create_only_tag_publication",
        "tag_immutability_enforced": False,
        "version_tag_is_authority": False,
        "version_tag_role": "discovery_only",
    }
    assert manifest["vulnerability_gate"]["passed"] is True
    checksums = (tmp_path / CHECKSUMS_NAME).read_text(encoding="utf-8")
    assert MANIFEST_NAME in checksums
    assert "RELEASE_NOTES.md" in checksums
    assert CHECKSUMS_NAME not in checksums


def test_tampering_and_release_blocking_vulnerabilities_fail_closed(
    tmp_path: Path,
) -> None:
    _create(tmp_path, **_inputs(tmp_path))
    (tmp_path / "uok.spdx.json").write_text("tampered", encoding="utf-8")
    with pytest.raises(ReleaseEvidenceError, match="Checksum mismatch"):
        verify_release_evidence(tmp_path)

    blocked = tmp_path / "blocked"
    blocked.mkdir()
    inputs = _inputs(
        blocked,
        vulnerabilities=[{"VulnerabilityID": "CVE-TEST", "Severity": "CRITICAL"}],
    )
    with pytest.raises(ReleaseEvidenceError, match="release-blocking"):
        _create(blocked, **inputs)


def test_trivy_report_must_bind_the_qualified_image_id(tmp_path: Path) -> None:
    inputs = _inputs(tmp_path)
    _write_json(
        inputs["vulnerability_report"],
        {
            "ArtifactType": "container_image",
            "Metadata": {"ImageID": f"sha256:{'d' * 64}"},
            "SchemaVersion": 2,
            "Results": [],
        },
    )
    with pytest.raises(ReleaseEvidenceError, match="qualified image"):
        _create(tmp_path, **inputs)


def test_non_image_trivy_report_fails_closed(tmp_path: Path) -> None:
    inputs = _inputs(tmp_path)
    _write_json(
        inputs["vulnerability_report"],
        {
            "ArtifactType": "filesystem",
            "Metadata": {"ImageID": CONFIG_DIGEST},
            "SchemaVersion": 2,
            "Results": [],
        },
    )
    with pytest.raises(ReleaseEvidenceError, match="container-image"):
        _create(tmp_path, **inputs)
