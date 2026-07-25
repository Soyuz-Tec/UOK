from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from threading import RLock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import env_flag
from ..host.database import get_db
from ..kernel_models import Membership, Organization, User
from ..seed import ORG_NAME
from ..util import hash_password, password_needs_rehash, verify_password
from .auth_policy import (
    build_legacy_sha256_login_deadline,
    is_valid_email,
    normalized_email,
)
from .auth_response import (
    session_response as _session_response,
    session_user_payload,
)
from .schemas import LoginRequest, RegisterRequest


router = APIRouter(prefix="/api/auth", tags=["auth"])

AUTH_ATTEMPTS: dict[str, list[float]] = {}
AUTH_ATTEMPTS_LOCK = RLock()
AUTH_RATE_LIMIT_WINDOW_SECONDS = 5 * 60
AUTH_RATE_LIMIT_MAX_ATTEMPTS = 12
AUTH_RATE_LIMIT_MAX_KEYS = 1024
LEGACY_SHA256_LOGIN_DEADLINE = build_legacy_sha256_login_deadline()


def auth_rate_key(scope: str, identity: str) -> str:
    normalized = identity.strip().lower()
    return f"{scope}:{sha256(normalized.encode('utf-8')).hexdigest()}"


def _active_auth_attempts(stamps: list[float], now: float) -> list[float]:
    return [stamp for stamp in stamps if now - stamp < AUTH_RATE_LIMIT_WINDOW_SECONDS]


def _prune_auth_attempts_locked(now: float) -> None:
    for key in tuple(AUTH_ATTEMPTS):
        attempts = _active_auth_attempts(AUTH_ATTEMPTS[key], now)
        if attempts:
            AUTH_ATTEMPTS[key] = attempts
        else:
            AUTH_ATTEMPTS.pop(key, None)


def prune_auth_attempts(now: float) -> None:
    with AUTH_ATTEMPTS_LOCK:
        _prune_auth_attempts_locked(now)


def _rate_limit_auth_keys(keys: tuple[str, ...], *, record: bool) -> None:
    unique_keys = tuple(dict.fromkeys(keys))
    now = monotonic()
    with AUTH_ATTEMPTS_LOCK:
        _prune_auth_attempts_locked(now)
        new_key_count = sum(key not in AUTH_ATTEMPTS for key in unique_keys)
        if len(AUTH_ATTEMPTS) + new_key_count > AUTH_RATE_LIMIT_MAX_KEYS:
            raise HTTPException(
                status_code=429,
                detail="Too many authentication attempts",
            )
        attempts_by_key = {
            key: _active_auth_attempts(AUTH_ATTEMPTS.get(key, []), now)
            for key in unique_keys
        }
        if any(
            len(attempts) >= AUTH_RATE_LIMIT_MAX_ATTEMPTS
            for attempts in attempts_by_key.values()
        ):
            raise HTTPException(
                status_code=429,
                detail="Too many authentication attempts",
            )
        if record:
            for key, attempts in attempts_by_key.items():
                AUTH_ATTEMPTS[key] = [*attempts, now]


def check_auth_rate_limits(*keys: str) -> None:
    _rate_limit_auth_keys(keys, record=False)


def record_auth_attempts(*keys: str) -> None:
    _rate_limit_auth_keys(keys, record=True)


def rate_limit_auth(key: str) -> None:
    record_auth_attempts(key)


def clear_auth_rate_key(key: str) -> None:
    with AUTH_ATTEMPTS_LOCK:
        AUTH_ATTEMPTS.pop(key, None)


def legacy_sha256_login_migration_active(
    *,
    now: datetime | None = None,
) -> bool:
    deadline = LEGACY_SHA256_LOGIN_DEADLINE
    return deadline is not None and (now or datetime.now(timezone.utc)) < deadline


def request_client_rate_key(scope: str, request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return auth_rate_key(f"{scope}-client", host)


@router.post("/login")
def login(
    req: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    rate_key = auth_rate_key("login", req.username)
    client_rate_key = request_client_rate_key("login", request)
    check_auth_rate_limits(client_rate_key, rate_key)
    user = db.scalar(select(User).where(User.username == req.username))
    if not user or not verify_password(
        req.password,
        user.password_hash,
        allow_legacy_sha256=legacy_sha256_login_migration_active(),
    ):
        record_auth_attempts(client_rate_key, rate_key)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(req.password)
        db.commit()
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        record_auth_attempts(client_rate_key, rate_key)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    clear_auth_rate_key(rate_key)
    return _session_response(
        user,
        membership,
        session_user_payload(user, membership),
    )


@router.post("/register")
def register(
    req: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if not env_flag("UOK_SELF_REGISTRATION"):
        raise HTTPException(status_code=403, detail="Self-registration is disabled")
    rate_key = auth_rate_key("register", req.email)
    client_rate_key = request_client_rate_key("register", request)
    record_auth_attempts(client_rate_key, rate_key)
    display_name = req.display_name.strip()
    email = normalized_email(req.email)
    if len(display_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Name must contain at least two characters",
        )
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
    user = User(
        username=email,
        password_hash=hash_password(req.password),
        display_name=display_name,
    )
    db.add(user)
    db.flush()
    membership = Membership(
        organization_id=org.id,
        user_id=user.id,
        role="pending_user",
    )
    db.add(membership)
    db.commit()
    return _session_response(
        user,
        membership,
        session_user_payload(user, membership),
    )
