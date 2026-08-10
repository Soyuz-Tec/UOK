from __future__ import annotations

import hashlib
import json
from typing import Any

from uok_release_workflow_yaml import (
    Mapping,
    mapping_value,
    plain,
    require_mapping,
    scalar_value,
    sequence_value,
)


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def contract_snapshot(
    root: Mapping,
) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    jobs = mapping_value(root, "jobs")
    job_hashes: dict[str, str] = {}
    step_hashes: dict[str, dict[str, str]] = {}
    for job_id, job_node in jobs.values.items():
        job = require_mapping(job_node, f"job {job_id}")
        config = {
            key: plain(value) for key, value in job.values.items() if key != "steps"
        }
        job_hashes[job_id] = _fingerprint(config)
        steps = sequence_value(job, "steps")
        step_hashes[job_id] = {}
        for step_node in steps.values:
            step = require_mapping(step_node, f"job {job_id} step")
            name = scalar_value(step, "name")
            content = {
                key: plain(value) for key, value in step.values.items() if key != "name"
            }
            step_hashes[job_id][name] = _fingerprint(content)
    return job_hashes, step_hashes
