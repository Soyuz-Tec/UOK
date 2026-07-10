from __future__ import annotations

import argparse
import json
import re
from uuid import uuid4

import httpx

STRONG_ETAG = re.compile(r'^"planning-r[1-9][0-9]*-sha256-[a-f0-9]{64}"$')


def main() -> None:
    args = arguments()
    base_url = args.base_url.rstrip("/")
    admin = login(base_url, args.admin_username, args.admin_password)
    ops = login(base_url, args.ops_username, args.ops_password)
    install_module(base_url, admin, "calendar.core")
    install_module(base_url, admin, "planning.core")
    suffix = uuid4().hex[:12]

    project = checked_request(
        "POST",
        f"{base_url}/api/planning/projects",
        headers={**ops, "Idempotency-Key": f"cpm-runtime-project-{suffix}"},
        json={"name": f"CPM runtime {suffix}", "start": "2026-08-03", "end": "2026-08-05"},
    )
    project_id = project.json()["id"]
    task = checked_request(
        "POST",
        f"{base_url}/api/planning/projects/{project_id}/tasks",
        headers={
            **ops,
            "Idempotency-Key": f"cpm-runtime-task-{suffix}",
            "If-Match": project.headers["ETag"],
        },
        json={"title": "Runtime delivery", "start": "2026-08-03", "end": "2026-08-07"},
    )
    schedule = checked_request("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops)
    body = schedule.json()
    calculation = body["calculation"]
    row = body["tasks"][0]
    expected = {
        "engine_version": "uok-cpm-1",
        "project_start": "2026-08-03",
        "calculated_finish": "2026-08-07",
        "target_finish": "2026-08-05",
        "target_variance_days": 2,
        "independent_validation": {"ok": True, "violations": []},
        "resource_capacity": {
            "engine_version": "uok-resource-capacity-1",
            "default_capacity_percent": 100,
            "load_points": [],
            "overallocated_count": 0,
            "independent_validation": {"ok": True, "violations": []},
        },
    }
    if calculation != expected:
        raise AssertionError(f"unexpected CPM calculation: {calculation}")
    if row["total_slack_days"] != -2 or row["free_float_days"] != -2 or row["critical"] is not True:
        raise AssertionError(f"negative-float task evidence is invalid: {row}")
    if not STRONG_ETAG.fullmatch(schedule.headers.get("ETag", "")):
        raise AssertionError("schedule did not return a strong Planning ETag")

    print(json.dumps({
        "status": "passed",
        "database_profile": body.get("database_profile", "PostgreSQL"),
        "project_id": project_id,
        "task_id": task.json()["id"],
        "engine_version": calculation["engine_version"],
        "calculated_finish": calculation["calculated_finish"],
        "target_finish": calculation["target_finish"],
        "target_variance_days": calculation["target_variance_days"],
        "total_slack_days": row["total_slack_days"],
        "independent_validation": calculation["independent_validation"]["ok"],
    }, sort_keys=True))


def login(base_url: str, username: str, password: str) -> dict[str, str]:
    response = checked_request("POST", f"{base_url}/api/auth/login", json={"username": username, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def install_module(base_url: str, headers: dict[str, str], module_name: str) -> None:
    checked_request("POST", f"{base_url}/api/modules/{module_name}/install", headers=headers)


def checked_request(method: str, url: str, **kwargs) -> httpx.Response:
    response = httpx.request(method, url, timeout=30, **kwargs)
    if response.status_code >= 400:
        raise AssertionError(f"{method} {url} failed with {response.status_code}: {response.text}")
    return response


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify canonical CPM against the persistent candidate runtime.")
    parser.add_argument("--base-url", default="http://127.0.0.1:18088")
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument("--admin-password", default="admin")
    parser.add_argument("--ops-username", default="ops")
    parser.add_argument("--ops-password", default="ops123")
    return parser.parse_args()


if __name__ == "__main__":
    main()
