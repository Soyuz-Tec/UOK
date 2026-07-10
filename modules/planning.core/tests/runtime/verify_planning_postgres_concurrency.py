from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
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
    project = request_json(
        "POST",
        f"{base_url}/api/planning/projects",
        headers={**ops, "Idempotency-Key": f"postgres-race-project-{suffix}"},
        json={"name": f"PostgreSQL race {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
    )
    project_id = project.json()["id"]
    before = request_json("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops)
    etag = before.headers.get("ETag", "")
    if not STRONG_ETAG.fullmatch(etag):
        raise AssertionError(f"schedule returned invalid ETag {etag!r}")
    revision = int(before.json()["project"]["revision"])

    barrier = Barrier(3)

    def create_task(index: int) -> httpx.Response:
        barrier.wait(timeout=10)
        with httpx.Client(timeout=30) as client:
            return client.post(
                f"{base_url}/api/planning/projects/{project_id}/tasks",
                headers={
                    **ops,
                    "Idempotency-Key": f"postgres-race-task-{index}-{suffix}",
                    "If-Match": etag,
                },
                json={
                    "title": f"Concurrent task {index}",
                    "start": "2026-08-03",
                    "end": "2026-08-05",
                    "expected_revision": revision,
                },
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(create_task, index) for index in (1, 2)]
        barrier.wait(timeout=10)
        responses = [future.result(timeout=40) for future in futures]

    statuses = sorted(response.status_code for response in responses)
    if statuses != [200, 412]:
        raise AssertionError(f"expected one 200 and one 412, got {statuses}: {[response.text for response in responses]}")
    stale = next(response for response in responses if response.status_code == 412)
    if stale.json().get("error", {}).get("code") != "stale_precondition":
        raise AssertionError(f"stale response was not structured: {stale.text}")

    after = request_json("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops)
    body = after.json()
    if int(body["project"]["revision"]) != revision + 1:
        raise AssertionError(f"expected revision {revision + 1}, got {body['project']['revision']}")
    if len(body["tasks"]) != 1 or int(body["tasks"][0]["version"]) != 1:
        raise AssertionError(f"expected one version-1 task, got {body['tasks']}")

    consistency_barrier = Barrier(2)

    def append_tasks() -> None:
        consistency_barrier.wait(timeout=10)
        for index in range(3, 8):
            latest = request_json("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops)
            request_json(
                "POST",
                f"{base_url}/api/planning/projects/{project_id}/tasks",
                headers={
                    **ops,
                    "Idempotency-Key": f"postgres-read-write-{index}-{suffix}",
                    "If-Match": latest.headers["ETag"],
                },
                json={"title": f"Read consistency task {index}", "start": "2026-08-03", "end": "2026-08-05"},
            )
            time.sleep(0.01)

    def read_consistent_snapshots() -> None:
        consistency_barrier.wait(timeout=10)
        for _ in range(30):
            snapshot = request_json("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops).json()
            expected_tasks = int(snapshot["project"]["revision"]) - revision
            if len(snapshot["tasks"]) != expected_tasks:
                raise AssertionError(f"mixed schedule snapshot: {snapshot['project']} with {len(snapshot['tasks'])} tasks")
            time.sleep(0.005)

    with ThreadPoolExecutor(max_workers=2) as pool:
        readers = [pool.submit(append_tasks), pool.submit(read_consistent_snapshots)]
        for future in readers:
            future.result(timeout=60)

    final_consistent_response = request_json("GET", f"{base_url}/api/planning/projects/{project_id}/schedule", headers=ops)
    final_consistent = final_consistent_response.json()
    if len(final_consistent["tasks"]) != 6:
        raise AssertionError(f"expected six tasks after consistency run, got {len(final_consistent['tasks'])}")

    print(json.dumps({
        "status": "passed",
        "database_profile": "PostgreSQL",
        "project_id": project_id,
        "initial_revision": revision,
        "final_revision": final_consistent["project"]["revision"],
        "statuses": statuses,
        "winner_etag": next(response.headers["ETag"] for response in responses if response.status_code == 200),
        "final_etag": final_consistent_response.headers["ETag"],
        "read_write_consistency": "passed",
    }, sort_keys=True))


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prove Planning row-lock concurrency against the live PostgreSQL profile.")
    parser.add_argument("--base-url", default="http://127.0.0.1:18088")
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument("--admin-password", default="admin")
    parser.add_argument("--ops-username", default="ops")
    parser.add_argument("--ops-password", default="ops123")
    return parser.parse_args()


def login(base_url: str, username: str, password: str) -> dict[str, str]:
    response = request_json("POST", f"{base_url}/api/auth/login", json={"username": username, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def install_module(base_url: str, headers: dict[str, str], module_name: str) -> None:
    request_json("POST", f"{base_url}/api/modules/{module_name}/install", headers=headers)


def request_json(method: str, url: str, **kwargs: object) -> httpx.Response:
    response = httpx.request(method, url, timeout=30, **kwargs)
    if response.status_code >= 400:
        raise AssertionError(f"{method} {url} returned {response.status_code}: {response.text}")
    return response


if __name__ == "__main__":
    main()
