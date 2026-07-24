from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Single SQLAlchemy declarative base shared by every in-process module."""


__all__ = ["Base"]
