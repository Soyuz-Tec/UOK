from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO_ROOT / "src"))

from uok.host.module_paths import ensure_module_backend_paths  # noqa: E402

ensure_module_backend_paths()

from uok.kernel.security import Actor  # noqa: E402
from uok.util import loads  # noqa: E402
from uok_planning_core._internal.portfolio_audit.replay_visibility import assert_planning_replay_visible  # noqa: E402


def main() -> None:
    args = arguments()
    base_url = args.base_url.rstrip("/")
    engine = create_engine(args.database_url)
    if engine.dialect.name != "postgresql":
        raise AssertionError("the replay/purge lock verifier requires PostgreSQL")

    admin = login(base_url, args.admin_username, args.admin_password)
    ops = login(base_url, args.ops_username, args.ops_password)
    install_module(base_url, admin, "calendar.core")
    install_module(base_url, admin, "planning.core")
    suffix = uuid4().hex[:12]
    key = f"postgres-replay-purge-{suffix}"
    payload = {
        "name": f"PostgreSQL replay purge {suffix}",
        "start": "2026-08-03",
        "end": "2026-08-28",
    }
    created = request_json(
        "POST",
        f"{base_url}/api/planning/projects",
        headers={**ops, "Idempotency-Key": key},
        json_body=payload,
    )
    project_id = str(created.json()["id"])
    replay_context = load_replay_context(engine, project_id, key, args.ops_username)

    assert_replay_lock_before_purge(
        engine,
        replay_context,
        base_url,
        ops,
        key,
        payload,
        project_id,
    )
    set_project_status(engine, project_id, "active")
    assert_purge_lock_before_replay(engine, base_url, ops, key, payload, project_id, replay_context[3])

    print(json.dumps({
        "status": "passed",
        "database_profile": "PostgreSQL",
        "project_id": project_id,
        "replay_lock_before_purge": "passed",
        "purge_lock_before_replay": "passed",
        "purged_replay_non_disclosure": "passed",
    }, sort_keys=True))


def load_replay_context(engine, project_id: str, key: str, username: str) -> tuple[Actor, dict, dict, str]:
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT project.organization_id, member.user_id, app_user.username, member.role,
                   command.id AS correlation_id, command.request_json, command.response_json
            FROM planning_projects project
            JOIN memberships member ON member.organization_id = project.organization_id
            JOIN users app_user ON app_user.id = member.user_id
            JOIN command_logs command
              ON command.organization_id = project.organization_id
             AND command.idempotency_key = :key
             AND command.status = 'succeeded'
            WHERE project.id = :project_id AND app_user.username = :username
        """), {"project_id": project_id, "key": key, "username": username}).mappings().one()
    actor = Actor(
        user_id=str(row["user_id"]),
        username=str(row["username"]),
        organization_id=str(row["organization_id"]),
        role=str(row["role"]),
    )
    return actor, loads(row["request_json"]), loads(row["response_json"]), str(row["correlation_id"])


def assert_replay_lock_before_purge(
    engine,
    replay_context: tuple[Actor, dict, dict, str],
    base_url: str,
    headers: dict[str, str],
    key: str,
    payload: dict[str, str],
    project_id: str,
) -> None:
    actor, stored_payload, stored_result, correlation_id = replay_context
    with Session(engine) as replay_session:
        transaction = replay_session.begin()
        assert_planning_replay_visible(
            replay_session,
            actor,
            "CreatePlanningProject",
            stored_payload,
            stored_result,
            correlation_id,
        )
        started = Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            purge = pool.submit(set_project_status, engine, project_id, "purged", started)
            if not started.wait(timeout=5):
                raise AssertionError("purge worker did not start")
            time.sleep(0.25)
            if purge.done():
                raise AssertionError("purge did not wait for the exact-replay project read lock")
            transaction.commit()
            purge.result(timeout=10)
    assert_hidden_replay(exact_replay(base_url, headers, key, payload), project_id, correlation_id)


def assert_purge_lock_before_replay(
    engine,
    base_url: str,
    headers: dict[str, str],
    key: str,
    payload: dict[str, str],
    project_id: str,
    correlation_id: str,
) -> None:
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text("SET LOCAL lock_timeout = '10s'"))
        connection.execute(text("UPDATE planning_projects SET status = 'purged' WHERE id = :project_id"), {
            "project_id": project_id,
        })
        with ThreadPoolExecutor(max_workers=1) as pool:
            replay = pool.submit(exact_replay, base_url, headers, key, payload)
            time.sleep(0.25)
            if replay.done():
                raise AssertionError("exact replay did not wait for the purge project write lock")
            transaction.commit()
            assert_hidden_replay(replay.result(timeout=10), project_id, correlation_id)
    finally:
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def set_project_status(engine, project_id: str, status: str, started: Event | None = None) -> None:
    with engine.begin() as connection:
        connection.execute(text("SET LOCAL lock_timeout = '10s'"))
        if started:
            started.set()
        connection.execute(text("UPDATE planning_projects SET status = :status WHERE id = :project_id"), {
            "status": status,
            "project_id": project_id,
        })


def exact_replay(base_url: str, headers: dict[str, str], key: str, payload: dict[str, str]) -> HttpResponse:
    return http_request(
        "POST",
        f"{base_url}/api/planning/projects",
        headers={**headers, "Idempotency-Key": key},
        json_body=payload,
    )


def assert_hidden_replay(response: HttpResponse, project_id: str, correlation_id: str) -> None:
    if response.status_code != 400:
        raise AssertionError(f"purged exact replay returned {response.status_code}: {response.text}")
    error = response.json().get("error", {})
    if error.get("code") != "planning_object_not_found":
        raise AssertionError(f"purged exact replay was not hidden: {response.text}")
    if error.get("object_ids") or error.get("correlation_id") is not None:
        raise AssertionError(f"purged exact replay disclosed recovered identifiers: {response.text}")
    if project_id in response.text or correlation_id in response.text:
        raise AssertionError(f"purged exact replay disclosed project or command identity: {response.text}")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prove both Planning replay/purge project-lock orderings.")
    parser.add_argument("--base-url", default="http://127.0.0.1:18088")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument("--admin-password", default="admin")
    parser.add_argument("--ops-username", default="ops")
    parser.add_argument("--ops-password", default="ops123")
    args = parser.parse_args()
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")
    return args


def login(base_url: str, username: str, password: str) -> dict[str, str]:
    response = request_json(
        "POST",
        f"{base_url}/api/auth/login",
        json_body={"username": username, "password": password},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def install_module(base_url: str, headers: dict[str, str], module_name: str) -> None:
    request_json("POST", f"{base_url}/api/modules/{module_name}/install", headers=headers)


def request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json_body: dict[str, str] | None = None,
) -> HttpResponse:
    response = http_request(method, url, headers=headers, json_body=json_body)
    if response.status_code >= 400:
        raise AssertionError(f"{method} {url} returned {response.status_code}: {response.text}")
    return response


@dataclass(frozen=True)
class HttpResponse:
    status_code: int
    body: bytes

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    def json(self) -> dict:
        value = json.loads(self.text)
        if not isinstance(value, dict):
            raise AssertionError(f"expected a JSON object, received: {self.text}")
        return value


def http_request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json_body: dict[str, str] | None = None,
) -> HttpResponse:
    body = json.dumps(json_body).encode("utf-8") if json_body is not None else None
    request_headers = dict(headers or {})
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            return HttpResponse(int(response.status), response.read())
    except HTTPError as error:
        return HttpResponse(int(error.code), error.read())


if __name__ == "__main__":
    main()
