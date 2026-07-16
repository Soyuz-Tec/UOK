from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy.orm import sessionmaker

from .db_pool import create_database_engine
from ..kernel.persistence import Base


def _database_url() -> str:
    data_dir = Path(os.getenv("DATA_DIR", "./data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return os.getenv("DATABASE_URL", f"sqlite:///{data_dir / 'uok.db'}")


DATABASE_URL = _database_url()
engine, database_pool_telemetry = create_database_engine(DATABASE_URL, os.environ)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    with SessionLocal() as db:
        yield db


def database_pool_snapshot() -> dict[str, object]:
    return database_pool_telemetry.snapshot()


__all__ = [
    "DATABASE_URL",
    "SessionLocal",
    "database_pool_snapshot",
    "database_pool_telemetry",
    "engine",
    "get_db",
]
