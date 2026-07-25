from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_release_workflow import (  # noqa: E402
    validate_release_policy,
    validate_release_policy_text,
)


WORKFLOW = (ROOT / ".github" / "workflows" / "uok-release.yml").read_text(
    encoding="utf-8"
)
DOCKERFILE = (ROOT / "Dockerfile").read_text(encoding="utf-8")


def _mutate(old: str, new: str) -> str:
    assert old in WORKFLOW
    return WORKFLOW.replace(old, new, 1)


def test_checked_in_release_workflow_satisfies_structural_policy() -> None:
    assert validate_release_policy(ROOT) == []


@pytest.mark.parametrize(
    ("old", "new"),
    [
        (
            'docker image tag "$QUALIFIED_IMAGE_ID" "$IMAGE_TAG"',
            'docker image tag "attacker:latest" "$IMAGE_TAG"',
        ),
        (
            'test "$object_sha" = "$SOURCE_COMMIT"',
            'echo "unverified $object_sha"',
        ),
        (
            "      packages: write\n    env:\n      IMAGE_REPOSITORY:",
            "      packages: write\n      issues: write\n    env:\n      IMAGE_REPOSITORY:",
        ),
        (
            "      - name: Authenticate to GHCR\n",
            "      - name: Hidden unpinned action\n"
            "        uses: attacker/example@main\n\n"
            "      - name: Authenticate to GHCR\n",
        ),
        (
            "image-ref: ${{ steps.image-identity.outputs.image_id }}",
            "image-ref: ${{ env.LOCAL_IMAGE }}",
        ),
        (
            "image: ${{ steps.image-identity.outputs.image_id }}",
            "image: ${{ env.LOCAL_IMAGE }}",
        ),
        (
            "Capture immutable local image identity",
            "Capture mutable image tag",
        ),
        (
            "version: https://github.com/docker/buildx.git#"
            "a319e5b15052cf6557ceb666eb8ff6e32380b782",
            "version: v0.35.0",
        ),
        (
            "moby/buildkit:v0.31.2@sha256:"
            "2f5adac4ecd194d9f8c10b7b5d7bceb5186853db1b26e5abd3a657af0b7e26ec",
            "moby/buildkit:latest",
        ),
        (
            'cmp "$RUNNER_TEMP/expected-release-files" \\\n'
            '            "$RUNNER_TEMP/actual-release-files"',
            'echo "unchecked release file set"',
        ),
        (
            "                and .immutable == true",
            "                and .immutable == false",
        ),
        (
            "          docker image load --input qualification/uok-image.tar\n",
            "          docker image load --input qualification/uok-image.tar\n"
            "          python scripts/unreviewed.py\n",
        ),
        (
            'echo "::error::Cannot prove image tag absence; GHCR returned HTTP $status"\n'
            "              exit 1",
            'echo "::warning::Proceeding after GHCR HTTP $status"\n              ;;',
        ),
        ('UOK_RELEASE_RULESET_ID: "19715390"', 'UOK_RELEASE_RULESET_ID: "7"'),
        (
            "      - name: Revalidate remote tag and publish qualified image\n"
            "        id: publish\n"
            "        env:\n"
            "          GH_TOKEN: ${{ github.token }}\n"
            "        run: |",
            "      - name: Revalidate remote tag and publish qualified image\n"
            "        id: publish\n"
            "        env:\n"
            "          GH_TOKEN: ${{ github.token }}\n"
            "        run: >-",
        ),
    ],
)
def test_policy_rejects_adversarial_workflow_mutations(old: str, new: str) -> None:
    problems = validate_release_policy_text(_mutate(old, new), DOCKERFILE)
    assert problems


def test_policy_rejects_duplicate_keys_and_yaml_indirection() -> None:
    duplicate = _mutate(
        "    permissions:\n      contents: read\n    outputs:",
        "    permissions:\n      contents: read\n    permissions:\n      contents: read\n    outputs:",
    )
    alias = _mutate(
        "permissions:\n  contents: read",
        "permissions: &shared\n  contents: read",
    )
    assert any(
        "duplicate key" in problem
        for problem in validate_release_policy_text(duplicate, DOCKERFILE)
    )
    assert any(
        "unsupported YAML" in problem
        for problem in validate_release_policy_text(alias, DOCKERFILE)
    )


def test_policy_rejects_unreviewed_action_commit() -> None:
    workflow = _mutate(
        "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        "actions/checkout@1111111111111111111111111111111111111111",
    )
    problems = validate_release_policy_text(workflow, DOCKERFILE)
    assert any("not pinned to its reviewed commit" in problem for problem in problems)


def test_policy_requires_exact_base_images_and_final_label_mapping() -> None:
    base = DOCKERFILE.replace(
        "python:3.14-alpine@sha256:"
        "26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92",
        "python:3.14-alpine",
        1,
    )
    label = DOCKERFILE.replace(
        'org.opencontainers.image.revision="${UOK_REVISION}"',
        'org.opencontainers.image.revision="unknown"',
        1,
    )
    assert any(
        "FROM stages" in problem
        for problem in validate_release_policy_text(WORKFLOW, base)
    )
    assert any(
        "OCI identity labels" in problem
        for problem in validate_release_policy_text(WORKFLOW, label)
    )
