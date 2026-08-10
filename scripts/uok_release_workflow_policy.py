from __future__ import annotations

import json
import re
from pathlib import Path

from uok_release_workflow_contract import (
    EXPECTED_ACTIONS,
    EXPECTED_BASES,
    EXPECTED_JOB_CONFIG_FINGERPRINTS,
    EXPECTED_STEP_FINGERPRINTS,
    JOB_NEEDS,
    JOB_ORDER,
    JOB_PERMISSIONS,
    STEP_ORDER,
)
from uok_release_workflow_snapshot import contract_snapshot
from uok_release_workflow_yaml import (
    Mapping,
    Scalar,
    WorkflowSyntaxError,
    mapping_value,
    needs,
    parse_workflow,
    plain,
    require_mapping,
    scalar_value,
    sequence_value,
    string_map,
)


SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")


def _validate_workflow(root: Mapping) -> list[str]:
    problems: list[str] = []
    expected_top = ("name", "on", "concurrency", "permissions", "env", "jobs")
    if tuple(root.values) != expected_top:
        problems.append(
            "Workflow top-level keys or order do not match the reviewed contract"
        )
    try:
        if scalar_value(root, "name") != "UOK Immutable Prerelease":
            problems.append("Workflow name is not canonical")
        if plain(mapping_value(root, "on")) != {"push": {"tags": ["UOK-*"]}}:
            problems.append("Workflow trigger must be exactly push tags UOK-*")
        if string_map(root, "permissions") != {"contents": "read"}:
            problems.append("Top-level permissions must be exactly contents: read")
        if string_map(root, "env") != {"UOK_RELEASE_RULESET_ID": "19715390"}:
            problems.append("Workflow must bind exact release ruleset 19715390")
        jobs = mapping_value(root, "jobs")
    except (KeyError, WorkflowSyntaxError) as exc:
        return problems + [f"Workflow structure is incomplete: {exc}"]
    if tuple(jobs.values) != JOB_ORDER:
        problems.append("Workflow job IDs or order do not match the reviewed contract")
        return problems

    job_hashes, step_hashes = contract_snapshot(root)
    for job_id in JOB_ORDER:
        job = require_mapping(jobs.values[job_id], f"job {job_id}")
        try:
            permissions = string_map(job, "permissions")
            if permissions != JOB_PERMISSIONS[job_id]:
                problems.append(
                    f"Job {job_id} permissions differ from the exact contract"
                )
            if needs(job) != JOB_NEEDS[job_id]:
                problems.append(f"Job {job_id} needs differ from the exact contract")
            steps = sequence_value(job, "steps")
            step_names = tuple(
                scalar_value(require_mapping(item, f"job {job_id} step"), "name")
                for item in steps.values
            )
            if step_names != STEP_ORDER[job_id]:
                problems.append(
                    f"Job {job_id} step names or order differ from the contract"
                )
        except (KeyError, WorkflowSyntaxError) as exc:
            problems.append(f"Job {job_id} structure is invalid: {exc}")
            continue

        if job_hashes.get(job_id) != EXPECTED_JOB_CONFIG_FINGERPRINTS.get(job_id):
            problems.append(f"Job {job_id} configuration fingerprint is not reviewed")
        expected_steps = EXPECTED_STEP_FINGERPRINTS.get(job_id, {})
        for name, actual in step_hashes.get(job_id, {}).items():
            if actual != expected_steps.get(name):
                problems.append(
                    f"Job {job_id} step {name!r} fingerprint is not reviewed"
                )

        for step_node in steps.values:
            step = require_mapping(step_node, f"job {job_id} step")
            uses = step.values.get("uses")
            if uses is None:
                continue
            if not isinstance(uses, Scalar) or "@" not in uses.value:
                problems.append(f"Job {job_id} contains a malformed action reference")
                continue
            action, reference = uses.value.rsplit("@", 1)
            reviewed = EXPECTED_ACTIONS.get(action)
            if action.startswith("./"):
                problems.append(f"Job {job_id} must not invoke a local action")
            elif reviewed != reference or SHA_PATTERN.fullmatch(reference) is None:
                problems.append(f"Action {action} is not pinned to its reviewed commit")

        if any(value == "write" for value in permissions.values()):
            raw_steps = json.dumps(plain(steps), sort_keys=True)
            if "actions/checkout@" in raw_steps:
                problems.append(
                    f"Write-capable job {job_id} must not check out repository code"
                )
            if re.search(r"(?:python\s+|[./]+)scripts/", raw_steps):
                problems.append(
                    f"Write-capable job {job_id} must not execute repository scripts"
                )
    return problems


def _docker_instructions(text: str) -> list[str]:
    instructions: list[str] = []
    current = ""
    for raw in text.replace("\r\n", "\n").splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        current = f"{current} {stripped}".strip()
        if current.endswith("\\"):
            current = current[:-1].rstrip()
            continue
        instructions.append(current)
        current = ""
    if current:
        instructions.append(current)
    return instructions


def _validate_dockerfile(text: str) -> list[str]:
    problems: list[str] = []
    instructions = _docker_instructions(text)
    from_values = tuple(
        instruction.split()[1]
        for instruction in instructions
        if instruction.upper().startswith("FROM ")
    )
    if from_values != EXPECTED_BASES:
        problems.append(
            "Dockerfile FROM stages do not match the three reviewed OCI index pins"
        )
    final_from = max(
        (
            index
            for index, instruction in enumerate(instructions)
            if instruction.upper().startswith("FROM ")
        ),
        default=-1,
    )
    final = instructions[final_from + 1 :]
    required_args = {
        "ARG UOK_VERSION=development",
        "ARG UOK_REVISION=unknown",
        "ARG UOK_SOURCE_URL=https://github.com/Soyuz-Tec/UOK",
    }
    if not required_args.issubset(final):
        problems.append("Dockerfile final stage is missing exact release identity ARGs")
    labels = [item for item in final if item.upper().startswith("LABEL ")]
    expected_labels = (
        'org.opencontainers.image.title="UOK" '
        'org.opencontainers.image.description="Unified Operating Kernel modular monolith" '
        'org.opencontainers.image.version="${UOK_VERSION}" '
        'org.opencontainers.image.revision="${UOK_REVISION}" '
        'org.opencontainers.image.source="${UOK_SOURCE_URL}"'
    )
    if len(labels) != 1 or labels[0][6:] != expected_labels:
        problems.append(
            "Dockerfile final OCI identity labels do not match the reviewed ARG mapping"
        )
    return problems


def validate_release_policy_text(workflow: str, dockerfile: str) -> list[str]:
    try:
        root = parse_workflow(workflow)
        problems = _validate_workflow(root)
    except (KeyError, WorkflowSyntaxError) as exc:
        problems = [f"Release workflow YAML is outside the strict policy subset: {exc}"]
    return problems + _validate_dockerfile(dockerfile)


def validate_release_policy(root: Path) -> list[str]:
    try:
        workflow = (root / ".github" / "workflows" / "uok-release.yml").read_text(
            encoding="utf-8"
        )
        dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    except OSError as exc:
        return [f"Cannot read release policy input: {exc}"]
    return validate_release_policy_text(workflow, dockerfile)
