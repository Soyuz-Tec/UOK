from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Any

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import uok_release_evidence as release  # noqa: E402
import uok_release_evidence_artifacts as artifacts  # noqa: E402


COMMIT = "a" * 40
DIGEST = f"sha256:{'b' * 64}"
CONFIG_DIGEST = f"sha256:{'c' * 64}"
VERSION = "3.1.0-alpha.3"


def _write_json(path: Path, value: object) -> Path:
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _valid_inputs(root: Path) -> dict[str, Path]:
    source = root / f"UOK-{VERSION}-source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr(
            release.PACKAGE_MANIFEST_NAME,
            json.dumps(
                {
                    "schema": "uok.source_package_manifest.v1",
                    "source_commit": COMMIT,
                    "version": VERSION,
                }
            ),
        )
    return {
        "source_package": source,
        "spdx_sbom": _write_json(
            root / "uok.spdx.json",
            {"spdxVersion": "SPDX-2.3"},
        ),
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
                "Results": [{"Vulnerabilities": []}],
            },
        ),
    }


def _create_arguments(root: Path) -> dict[str, Any]:
    return {
        "output_directory": root,
        "tag": f"UOK-{VERSION}",
        "version": VERSION,
        "source_commit": COMMIT,
        "github_repository": "Soyuz-Tec/UOK",
        "image_repository": "ghcr.io/soyuz-tec/uok",
        "image_digest": DIGEST,
        "image_config_digest": CONFIG_DIGEST,
        **_valid_inputs(root),
    }


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        (
            {"source_commit": "bad", "tag": "UOK-wrong"},
            "Source commit must be a full hexadecimal Git commit id",
        ),
        ({"tag": "UOK-wrong"}, "Release tag and version do not match"),
        (
            {"image_digest": f"sha256:{'A' * 64}"},
            "Image digest must be a lowercase sha256 digest",
        ),
        (
            {"image_config_digest": f"sha256:{'A' * 64}"},
            "Image configuration digest must be a lowercase sha256 digest",
        ),
        (
            {"image_repository": "ghcr.io/Soyuz-Tec/UOK"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"image_repository": "ghcr.io/"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"image_repository": "ghcr.io/../uok"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"image_repository": "evil.example/ghcr.io/soyuz-tec/uok"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"image_repository": "ghcr.io/soyuz-tec/uok?tag=latest"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"image_repository": "ghcr.io/other/uok"},
            "Image repository must be a lowercase GHCR path",
        ),
        (
            {"github_repository": "Soyuz-Tec/UOK\n`unsafe`"},
            "GitHub repository must use the owner/name form",
        ),
    ],
)
def test_release_identity_validation_preserves_errors_and_order(
    tmp_path: Path,
    overrides: dict[str, str],
    message: str,
) -> None:
    arguments = _create_arguments(tmp_path)
    arguments.update(overrides)

    with pytest.raises(release.ReleaseEvidenceError, match=re.escape(message)):
        release.create_release_evidence(**arguments)


def test_release_creation_rejects_the_exact_unexpected_file_set(
    tmp_path: Path,
) -> None:
    arguments = _create_arguments(tmp_path)
    (tmp_path / "unexpected.txt").write_text("unexpected", encoding="utf-8")

    with pytest.raises(
        release.ReleaseEvidenceError,
        match=re.escape(
            "Release directory contains unexpected files: ['unexpected.txt']"
        ),
    ):
        release.create_release_evidence(**arguments)


def test_release_creation_self_verifies_before_returning_exact_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[Path] = []

    def capture(directory: Path) -> dict[str, object]:
        calls.append(directory)
        assert (directory / release.MANIFEST_NAME).is_file()
        assert (directory / release.NOTES_NAME).is_file()
        assert (directory / release.CHECKSUMS_NAME).is_file()
        return {}

    monkeypatch.setattr(artifacts, "verify_release_evidence", capture)

    paths = release.create_release_evidence(**_create_arguments(tmp_path))

    assert calls == [tmp_path.resolve()]
    assert list(paths) == ["manifest", "notes", "checksums"]
    assert paths == {
        "manifest": tmp_path / release.MANIFEST_NAME,
        "notes": tmp_path / release.NOTES_NAME,
        "checksums": tmp_path / release.CHECKSUMS_NAME,
    }
