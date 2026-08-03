from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any

from uok_release_evidence_common import (
    CHECKSUMS_NAME,
    MANIFEST_NAME,
    NOTES_NAME,
    PACKAGE_MANIFEST_NAME,
    SAFE_NAME_PATTERN,
    ReleaseEvidenceError,
    load_json,
    sha256_file,
)
from uok_release_evidence_verify import verify_release_evidence


def checked_artifact(path: Path, output_directory: Path) -> Path:
    resolved = path.resolve()
    if (
        resolved.parent != output_directory
        or not resolved.is_file()
        or resolved.is_symlink()
    ):
        raise ReleaseEvidenceError(
            f"Release artifact must be a regular file directly under {output_directory}: {path}"
        )
    if SAFE_NAME_PATTERN.fullmatch(resolved.name) is None:
        raise ReleaseEvidenceError(
            f"Unsafe release artifact filename: {resolved.name!r}"
        )
    return resolved


def validate_source_package(
    path: Path,
    *,
    version: str,
    source_commit: str,
) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            package_manifest = json.loads(archive.read(PACKAGE_MANIFEST_NAME))
    except (OSError, KeyError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        raise ReleaseEvidenceError(
            f"{path.name} does not contain a valid {PACKAGE_MANIFEST_NAME}"
        ) from exc
    if package_manifest.get("schema") != "uok.source_package_manifest.v1":
        raise ReleaseEvidenceError("Source package manifest schema is not supported")
    if package_manifest.get("version") != version:
        raise ReleaseEvidenceError("Source package version does not match the release")
    if package_manifest.get("source_commit") != source_commit:
        raise ReleaseEvidenceError("Source package commit does not match the release")


def validate_sbom(path: Path, expected_format: str) -> None:
    sbom = load_json(path)
    if not isinstance(sbom, dict):
        raise ReleaseEvidenceError(f"{path.name} must contain a JSON object")
    if expected_format == "spdx" and not str(sbom.get("spdxVersion", "")).startswith(
        "SPDX-"
    ):
        raise ReleaseEvidenceError(f"{path.name} is not an SPDX JSON SBOM")
    if expected_format == "cyclonedx" and sbom.get("bomFormat") != "CycloneDX":
        raise ReleaseEvidenceError(f"{path.name} is not a CycloneDX JSON SBOM")


def validate_vulnerability_report(
    path: Path,
    *,
    expected_image_id: str,
) -> None:
    report = load_json(path)
    if not isinstance(report, dict) or not isinstance(report.get("Results", []), list):
        raise ReleaseEvidenceError(f"{path.name} is not a Trivy JSON report")
    if report.get("ArtifactType") != "container_image":
        raise ReleaseEvidenceError(f"{path.name} is not a Trivy container-image report")
    metadata = report.get("Metadata")
    if not isinstance(metadata, dict) or metadata.get("ImageID") != expected_image_id:
        raise ReleaseEvidenceError(
            f"{path.name} does not identify the qualified image configuration"
        )
    blocked: list[str] = []
    for result in report.get("Results", []):
        for vulnerability in result.get("Vulnerabilities") or []:
            severity = str(vulnerability.get("Severity", "")).upper()
            if severity in {"HIGH", "CRITICAL"}:
                blocked.append(
                    f"{vulnerability.get('VulnerabilityID', 'unknown')} ({severity})"
                )
    if blocked:
        raise ReleaseEvidenceError(
            "Trivy report contains release-blocking vulnerabilities: "
            + ", ".join(blocked)
        )


def artifact_record(path: Path, *, role: str, media_type: str) -> dict[str, Any]:
    return {
        "filename": path.name,
        "media_type": media_type,
        "role": role,
        "sha256": sha256_file(path),
        "size": path.stat().st_size,
    }


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _release_notes(manifest: dict[str, Any]) -> str:
    image = manifest["image"]
    repository = manifest["github_repository"]
    tag = manifest["tag"]
    source_commit = manifest["source_commit"]
    return f"""# UOK {manifest["version"]} prerelease

This prerelease is bound to one Git tag, one source commit, and one immutable
OCI image digest. It is not a production-readiness claim.

## Immutable identity

- Tag: `{tag}`
- Source commit: `{source_commit}`
- OCI image: `{image["reference"]}`
- Image configuration: `{image["config_digest"]}`
- Published tag: `{image["published_tag"]}` (discovery only; deploy the digest)

## Verify

```bash
sha256sum --check {CHECKSUMS_NAME}
gh attestation verify \\
  oci://{image["reference"]} \\
  --repo {repository} \\
  --signer-workflow {repository}/.github/workflows/uok-release.yml \\
  --source-ref refs/tags/{tag}
```

The release bundle includes SPDX JSON and CycloneDX JSON SBOMs, the blocking
Trivy report, the deterministic source package, and `{MANIFEST_NAME}`. GHCR
does not provide UOK with an atomic create-only push or an enforced immutable
tag. The workflow refuses a tag it can already observe, but another authorized
package writer could race that check. The digest above, not the version tag, is
the release authority.

## Rollback boundary

Do not move this Git tag, overwrite the published version tag, or deploy a
mutable tag. Roll back by redeploying the previously approved
`ghcr.io/...@sha256:<digest>` recorded by the target environment, then verify
UOK health and database compatibility. Selecting that previous digest is an
operator-controlled deployment decision; this prerelease does not guess it.
"""


def write_and_verify_release_evidence(
    output_directory: Path,
    manifest: dict[str, Any],
) -> dict[str, Path]:
    manifest_path = output_directory / MANIFEST_NAME
    notes_path = output_directory / NOTES_NAME
    checksums_path = output_directory / CHECKSUMS_NAME
    _write_json(manifest_path, manifest)
    notes_path.write_text(_release_notes(manifest), encoding="utf-8", newline="\n")
    checksum_files = sorted(
        path
        for path in output_directory.iterdir()
        if path.is_file() and path.name != CHECKSUMS_NAME
    )
    checksums_path.write_text(
        "".join(f"{sha256_file(path)}  {path.name}\n" for path in checksum_files),
        encoding="utf-8",
        newline="\n",
    )
    verify_release_evidence(output_directory)
    return {"manifest": manifest_path, "notes": notes_path, "checksums": checksums_path}


__all__ = [
    "artifact_record",
    "checked_artifact",
    "validate_sbom",
    "validate_source_package",
    "validate_vulnerability_report",
    "write_and_verify_release_evidence",
]
