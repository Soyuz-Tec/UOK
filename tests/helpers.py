from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from uok.db import SessionLocal
from uok.models import User


def auth(client: TestClient, username: str, password: str) -> dict[str, str]:
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def command(client: TestClient, headers: dict[str, str], command_type: str, payload: dict, key: str):
    return client.post("/api/commands", headers=headers, json={
        "command_type": command_type,
        "payload": payload,
        "idempotency_key": key,
    })


def user_id(username: str) -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert user is not None
        return user.id
