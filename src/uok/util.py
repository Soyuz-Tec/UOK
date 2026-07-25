from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError


PASSWORD_HASHER = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)


def dumps(value: Any) -> str:
    def default(obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(type(obj).__name__)

    return json.dumps(value, default=default, sort_keys=True)


def loads(value: str | None, fallback: Any = None) -> Any:
    if value in (None, ""):
        return fallback if fallback is not None else {}
    return json.loads(value)


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    if not password_hash.startswith("$argon2id$"):
        return False
    try:
        return PASSWORD_HASHER.verify(password_hash, password)
    except InvalidHashError, VerificationError, VerifyMismatchError:
        return False


def password_needs_rehash(password_hash: str) -> bool:
    if not password_hash.startswith("$argon2id$"):
        return True
    try:
        return PASSWORD_HASHER.check_needs_rehash(password_hash)
    except InvalidHashError, VerificationError:
        return True


def row_dict(obj: Any, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        if column.name.endswith("_json"):
            data[column.name[:-5]] = loads(
                value, [] if column.name == "parties_json" else {}
            )
        elif hasattr(value, "isoformat"):
            data[column.name] = value.isoformat()
        else:
            data[column.name] = value
    if extra:
        data.update(extra)
    return data
