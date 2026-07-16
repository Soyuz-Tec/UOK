from __future__ import annotations

import base64
import binascii
import hmac
import json
import os
import time
from hashlib import sha256
from hmac import compare_digest

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..kernel.security import Actor
from ..kernel_models import Membership, User
from .database import get_db


WEAK_LOCAL_SECRETS = {"", "uok-local-secret", "change-me-local", "local-uok-change-me", "ci-uok-secret"}
DEFAULT_TOKEN_TTL_SECONDS = 8 * 60 * 60


def _secret() -> str:
    secret = os.getenv("UOK_SECRET", "")
    allow_insecure = os.getenv("UOK_ALLOW_INSECURE_LOCAL_DEFAULTS", "0") == "1"
    if not secret:
        if allow_insecure:
            return "uok-local-secret"
        raise RuntimeError("UOK_SECRET must be set")
    if secret in WEAK_LOCAL_SECRETS and not allow_insecure:
        raise RuntimeError("UOK_SECRET is a weak local-only value")
    if len(secret) < 32 and not allow_insecure:
        raise RuntimeError("UOK_SECRET must be at least 32 characters")
    return secret


def _token_ttl_seconds() -> int:
    raw = os.getenv("UOK_TOKEN_TTL_SECONDS", str(DEFAULT_TOKEN_TTL_SECONDS))
    try:
        ttl = int(raw)
    except ValueError:
        ttl = DEFAULT_TOKEN_TTL_SECONDS
    return max(300, min(ttl, 24 * 60 * 60))


def _sign(body: str) -> str:
    return hmac.new(_secret().encode("utf-8"), body.encode("utf-8"), sha256).hexdigest()


def issue_token(actor: Actor) -> str:
    now = int(time.time())
    payload = {
        "version": 1,
        "user_id": actor.user_id,
        "username": actor.username,
        "organization_id": actor.organization_id,
        "role": actor.role,
        "iat": now,
        "exp": now + _token_ttl_seconds(),
    }
    body = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode()).decode().rstrip("=")
    sig = _sign(body)
    return f"{body}.{sig}"


def parse_token(token: str) -> Actor:
    try:
        body, sig = token.split(".", 1)
        expected = _sign(body)
        if not compare_digest(sig, expected):
            raise ValueError
        padded = body + "=" * (-len(body) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        if payload.get("version") != 1:
            raise ValueError
        if int(payload["exp"]) < int(time.time()):
            raise HTTPException(status_code=401, detail="Token expired")
        return Actor(
            user_id=payload["user_id"],
            username=payload["username"],
            organization_id=payload["organization_id"],
            role=payload["role"],
        )
    except HTTPException:
        raise
    except (binascii.Error, KeyError, TypeError, UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def current_actor(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Actor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    actor = parse_token(authorization.split(" ", 1)[1])
    user = db.get(User, actor.user_id)
    membership = db.scalar(select(Membership).where(
        Membership.user_id == actor.user_id,
        Membership.organization_id == actor.organization_id,
        Membership.role == actor.role,
    ))
    if not user or not membership:
        raise HTTPException(status_code=401, detail="Token subject no longer exists")
    return actor


__all__ = ["current_actor", "issue_token", "parse_token"]
