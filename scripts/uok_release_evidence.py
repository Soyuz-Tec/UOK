from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Any

from uok_release_evidence_artifacts import (
    artifact_record,
    checked_artifact,
    validate_sbom,
    validate_source_package,
    validate_vulnerability_report,
    write_and_verify_release_evidence,
)
from uok_release_evidence_common import (
    CHECKSUMS_NAME as CHECKSUMS_NAME,
    COMMIT_PATTERN,
    DIGEST_PATTERN,
    MANIFEST_NAME as MANIFEST_NAME,
    NOTES_NAME as NOTES_NAME,
    PACKAGE_MANIFEST_NAME as PACKAGE_MANIFEST_NAME,
    SAFE_NAME_PATTERN as SAFE_NAME_PATTERN,
    ReleaseEvidenceError as ReleaseEvidenceError,
    release_controls,
    validate_repository_identity,
)
from uok_release_evidence_verify import (
    verify_release_evidence as verify_release_evidence,
)


def _validate_release_identity(
    *,
    tag: str,
    version: str,
    source_commit: str,
    github_repository: str,
    image_repository: str,
    image_digest: str,
    image_config_digest: str,
) -> None:
    if not COMMIT_PATTERN.fullmatch(source_commit):
        raise ReleaseEvidenceError(
            "Source commit must be a full hexadecimal Git commit id"
        )
    if tag != f"UOK-{version}":
        raise ReleaseEvidenceError("Release tag and version do not match")
    if not DIGEST_PATTERN.fullmatch(image_digest):
        raise ReleaseEvidenceError("Image digest must be a lowercase sha256 digest")
    if not DIGEST_PATTERN.fullmatch(image_config_digest):
        raise ReleaseEvidenceError(
            "Image configuration digest must be a lowercase sha256 digest"
        )
    validate_repository_identity(
        github_repository=github_repository,
        image_repository=image_repository,
    )


def _validated_release_inputs(
    *,
    output_directory: Path,
    version: str,
    source_commit: str,
    image_config_digest: str,
    source_package: Path,
    spdx_sbom: Path,
    cyclonedx_sbom: Path,
    vulnerability_report: Path,
) -> dict[str, Path]:
    inputs = {
        "source": checked_artifact(source_package, output_directory),
        "spdx": checked_artifact(spdx_sbom, output_directory),
        "cyclonedx": checked_artifact(cyclonedx_sbom, output_directory),
        "scan": checked_artifact(vulnerability_report, output_directory),
    }
    expected_names = {path.name for path in inputs.values()}
    unexpected = {
        path.name
        for path in output_directory.iterdir()
        if path.is_file() and path.name not in expected_names
    }
    if unexpected:
        raise ReleaseEvidenceError(
            f"Release directory contains unexpected files: {sorted(unexpected)}"
        )
    validate_source_package(
        inputs["source"], version=version, source_commit=source_commit
    )
    validate_sbom(inputs["spdx"], "spdx")
    validate_sbom(inputs["cyclonedx"], "cyclonedx")
    validate_vulnerability_report(
        inputs["scan"],
        expected_image_id=image_config_digest,
    )
    return inputs


def _release_artifacts(inputs: Mapping[str, Path]) -> list[dict[str, Any]]:
    artifacts = [
        artifact_record(
            inputs["source"], role="source_package", media_type="application/zip"
        ),
        artifact_record(
            inputs["spdx"], role="spdx_sbom", media_type="application/spdx+json"
        ),
        artifact_record(
            inputs["cyclonedx"],
            role="cyclonedx_sbom",
            media_type="application/vnd.cyclonedx+json",
        ),
        artifact_record(
            inputs["scan"], role="vulnerability_report", media_type="application/json"
        ),
    ]
    artifacts.sort(key=lambda item: item["filename"])
    return artifacts


def _release_manifest(
    *,
    artifacts: list[dict[str, Any]],
    tag: str,
    version: str,
    source_commit: str,
    github_repository: str,
    image_repository: str,
    image_digest: str,
    image_config_digest: str,
) -> dict[str, Any]:
    image_reference = f"{image_repository}@{image_digest}"
    return {
        "artifacts": artifacts,
        "attestation_policy": {
            "github_artifact_provenance": True,
            "image_provenance_pushed_to_registry": True,
            "sbom_formats": ["cyclonedx-json", "spdx-json"],
        },
        "github_repository": github_repository,
        "image": {
            "config_digest": image_config_digest,
            "digest": image_digest,
            "published_tag": f"{image_repository}:{version}",
            "reference": image_reference,
            "repository": image_repository,
        },
        "release_controls": release_controls(),
        "rollback": {
            "deployment_by_mutable_tag_permitted": False,
            "previous_approved_digest_required": True,
            "strategy": "redeploy_previous_approved_digest",
        },
        "schema": "uok.release_manifest.v1",
        "source_commit": source_commit,
        "tag": tag,
        "version": version,
        "vulnerability_gate": {
            "blocked_severities": ["HIGH", "CRITICAL"],
            "ignore_unfixed": False,
            "passed": True,
        },
    }


def create_release_evidence(
    *,
    output_directory: Path,
    tag: str,
    version: str,
    source_commit: str,
    github_repository: str,
    image_repository: str,
    image_digest: str,
    image_config_digest: str,
    source_package: Path,
    spdx_sbom: Path,
    cyclonedx_sbom: Path,
    vulnerability_report: Path,
) -> dict[str, Path]:
    output_directory = output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    _validate_release_identity(
        tag=tag,
        version=version,
        source_commit=source_commit,
        github_repository=github_repository,
        image_repository=image_repository,
        image_digest=image_digest,
        image_config_digest=image_config_digest,
    )
    inputs = _validated_release_inputs(
        output_directory=output_directory,
        version=version,
        source_commit=source_commit,
        image_config_digest=image_config_digest,
        source_package=source_package,
        spdx_sbom=spdx_sbom,
        cyclonedx_sbom=cyclonedx_sbom,
        vulnerability_report=vulnerability_report,
    )
    manifest = _release_manifest(
        artifacts=_release_artifacts(inputs),
        tag=tag,
        version=version,
        source_commit=source_commit,
        github_repository=github_repository,
        image_repository=image_repository,
        image_digest=image_digest,
        image_config_digest=image_config_digest,
    )
    return write_and_verify_release_evidence(output_directory, manifest)
