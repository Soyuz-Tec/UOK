from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./data/test_uok_baseline.db"
os.environ["DATA_DIR"] = "./data"
os.environ["UOK_SECRET"] = "pytest-uok"
os.environ["UOK_ALLOW_INSECURE_LOCAL_DEFAULTS"] = "1"
os.environ["UOK_AUTO_CREATE_SCHEMA"] = "1"
os.environ["UOK_SEED_LOCAL_DATA"] = "1"
os.environ["UOK_RESET_DEMO_PASSWORDS"] = "1"
os.environ["UOK_SELF_REGISTRATION"] = "1"
os.environ["UOK_TOKEN_TTL_SECONDS"] = "3600"

for suffix in ("", "-wal", "-shm"):
    Path(f"data/test_uok_baseline.db{suffix}").unlink(missing_ok=True)

from uok.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
