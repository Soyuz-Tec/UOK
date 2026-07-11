from __future__ import annotations

from pathlib import Path


CAPACITY_ENV_KEYS = (
    "UOK_DB_POOL_SIZE",
    "UOK_DB_MAX_OVERFLOW",
    "UOK_DB_POOL_TIMEOUT_SECONDS",
    "UOK_DB_POOL_PRE_PING",
    "UOK_DB_POOL_RECYCLE_SECONDS",
    "UOK_DB_CONNECT_TIMEOUT_SECONDS",
    "UOK_DB_APPLICATION_NAME",
    "UOK_API_WORKERS",
    "UOK_API_REPLICAS",
    "UOK_DB_DIRECT_TOOLS_RESERVE",
    "UOK_DB_OPERATIONAL_HEADROOM",
    "UOK_DB_MAX_CONNECTIONS",
    "UOK_DB_SUPERUSER_RESERVED_CONNECTIONS",
    "UOK_DB_RESERVED_CONNECTIONS",
)
OFFLINE_COMMAND = (
    "python scripts/verify_database_capacity.py "
    "--environment-file deploy/database-capacity.env"
)


def _read(root: Path, relative_path: str) -> str:
    return (root / relative_path).read_text(encoding="utf-8", errors="ignore")


def database_capacity_policy_problems(root: Path) -> list[str]:
    try:
        capacity_env = _read(root, "deploy/database-capacity.env")
        compose = _read(root, "deploy/compose-local-18088.yaml")
        capacity_script = _read(root, "scripts/verify_database_capacity.py")
        ci = _read(root, ".github/workflows/uok-ci.yml")
    except OSError:
        return ["database capacity policy artifacts are unavailable"]

    declared_names = [
        line.partition("=")[0].strip()
        for line in capacity_env.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    checks = {
        "canonical database capacity environment is complete": all(
            f"{name}=" in capacity_env for name in CAPACITY_ENV_KEYS
        ),
        "capacity environment excludes secrets": not any(
            marker in capacity_env for marker in ("DATABASE_URL=", "PASSWORD=", "SECRET=")
        ),
        "Compose loads the canonical capacity environment": (
            "env_file:\n      - ./database-capacity.env" in compose
            and not any(name in compose for name in declared_names)
        ),
        "CI enforces the canonical capacity environment": OFFLINE_COMMAND in ci,
        "capacity verifier uses the live helper": "database_capacity_live" in capacity_script,
    }
    return [name for name, ok in checks.items() if not ok]
