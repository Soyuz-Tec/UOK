from __future__ import annotations

import re
import time
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..api.schemas import LoginRequest, RegisterRequest
from ..config import env_flag
from ..host.database import get_db
from ..kernel_models import Membership, Organization, User
from ..security import Actor, issue_token
from ..seed import ORG_NAME
from ..util import hash_password, password_needs_rehash, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
AUTH_ATTEMPTS: dict[str, list[float]] = {}
AUTH_RATE_LIMIT_WINDOW_SECONDS = 5 * 60
AUTH_RATE_LIMIT_MAX_ATTEMPTS = 12
AUTH_RATE_LIMIT_MAX_KEYS = 1024


def auth_rate_key(scope: str, identity: str) -> str:
    normalized = identity.strip().lower()
    return f"{scope}:{sha256(normalized.encode('utf-8')).hexdigest()}"


def prune_auth_attempts(now: float) -> None:
    stale = [
        key for key, stamps in AUTH_ATTEMPTS.items()
        if not [stamp for stamp in stamps if now - stamp < AUTH_RATE_LIMIT_WINDOW_SECONDS]
    ]
    for key in stale:
        AUTH_ATTEMPTS.pop(key, None)


def rate_limit_auth(key: str) -> None:
    now = time.time()
    prune_auth_attempts(now)
    if key not in AUTH_ATTEMPTS and len(AUTH_ATTEMPTS) >= AUTH_RATE_LIMIT_MAX_KEYS:
        oldest_keys = sorted(
            AUTH_ATTEMPTS,
            key=lambda existing_key: max(AUTH_ATTEMPTS[existing_key]) if AUTH_ATTEMPTS[existing_key] else 0,
        )
        for existing_key in oldest_keys[: max(1, len(AUTH_ATTEMPTS) - AUTH_RATE_LIMIT_MAX_KEYS + 1)]:
            AUTH_ATTEMPTS.pop(existing_key, None)
    attempts = [stamp for stamp in AUTH_ATTEMPTS.get(key, []) if now - stamp < AUTH_RATE_LIMIT_WINDOW_SECONDS]
    if len(attempts) >= AUTH_RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many authentication attempts")
    attempts.append(now)
    AUTH_ATTEMPTS[key] = attempts


def normalized_email(value: str) -> str:
    return value.strip().lower()


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_RE.match(normalized_email(value)))


def session_user_payload(user: User, membership: Membership) -> dict[str, str | None]:
    return {
        "username": user.username,
        "display_name": user.display_name,
        "email": user.username if is_valid_email(user.username) else None,
        "role": membership.role,
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    rate_key = auth_rate_key("login", req.username)
    rate_limit_auth(rate_key)
    user = db.scalar(select(User).where(User.username == req.username))
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    AUTH_ATTEMPTS.pop(rate_key, None)
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(req.password)
        db.commit()
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=401, detail="User has no membership")
    actor = Actor(user_id=user.id, username=user.username, organization_id=membership.organization_id, role=membership.role)
    return {"access_token": issue_token(actor), "user": session_user_payload(user, membership)}


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    if not env_flag("UOK_SELF_REGISTRATION"):
        raise HTTPException(status_code=403, detail="Self-registration is disabled")
    rate_key = auth_rate_key("register", req.email)
    rate_limit_auth(rate_key)
    display_name = req.display_name.strip()
    email = normalized_email(req.email)
    if len(display_name) < 2:
        raise HTTPException(status_code=400, detail="Name must contain at least two characters")
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    existing = db.scalar(select(User).where(User.username == email))
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")
    org = db.scalar(select(Organization).where(Organization.name == ORG_NAME))
    if not org:
        org = Organization(name=ORG_NAME)
        db.add(org)
        db.flush()
    user = User(username=email, password_hash=hash_password(req.password), display_name=display_name)
    db.add(user)
    db.flush()
    membership = Membership(organization_id=org.id, user_id=user.id, role="pending_user")
    db.add(membership)
    db.commit()
    AUTH_ATTEMPTS.pop(rate_key, None)
    actor = Actor(user_id=user.id, username=user.username, organization_id=membership.organization_id, role=membership.role)
    return {"access_token": issue_token(actor), "user": session_user_payload(user, membership)}
