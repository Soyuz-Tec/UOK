from __future__ import annotations

from typing import Any

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import APP_VERSION, TARGET_VERSION
from .kernel_models import SchemaVersion


def liveness_report() -> dict[str, Any]:
    return {
        "status": "ok",
        "name": "UOK",
        "version": APP_VERSION,
    }


def readiness_report(db: Session) -> dict[str, Any]:
    checks = {
        "database": "unavailable",
        "schema": "unavailable",
    }
    try:
        db.execute(text("SELECT 1")).scalar_one()
        checks["database"] = "ok"
        applied = db.scalar(
            select(SchemaVersion.version).where(
                SchemaVersion.version == TARGET_VERSION
            )
        )
        checks["schema"] = "ok" if applied == TARGET_VERSION else "out_of_date"
    except SQLAlchemyError:
        try:
            db.rollback()
        except SQLAlchemyError:
            pass

    return {
        "status": "ok" if all(value == "ok" for value in checks.values()) else "unavailable",
        "name": "UOK",
        "version": APP_VERSION,
        "target_version": TARGET_VERSION,
        "checks": checks,
    }


__all__ = ["liveness_report", "readiness_report"]
