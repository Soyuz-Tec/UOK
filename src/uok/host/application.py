from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from .. import APP_VERSION
from ..module_contract_validation import validate_module_runtime_contracts


runtime_contract = validate_module_runtime_contracts()
if not runtime_contract["ok"]:
    raise RuntimeError(f"Module runtime contract is invalid: {runtime_contract['violations']}")

from .model_registry import ensure_module_models_registered

ensure_module_models_registered()

from ..kernel.module_runtime import ModuleRuntimePort, configure_module_runtime
from ..kernel.security import configure_role_grants
from ..module_ops import (
    disable_module,
    enable_module,
    ensure_module_operational,
    install_module,
    module_maintenance_report,
    module_record,
    module_status,
    reconcile_module_record,
    uninstall_module,
    upgrade_module,
)
from ..modules import module_catalog, module_contracts, module_lifecycle_report
from .module_policy import module_role_grants


def _module_record_status(db: object, organization_id: str, module_name: str) -> str | None:
    record = module_record(db, organization_id, module_name)
    return None if record is None else str(record.status)


configure_module_runtime(ModuleRuntimePort(
    catalog=module_catalog,
    contracts=module_contracts,
    lifecycle_report=module_lifecycle_report,
    status=module_status,
    maintenance_report=module_maintenance_report,
    install=install_module,
    uninstall=uninstall_module,
    disable=disable_module,
    enable=enable_module,
    upgrade=upgrade_module,
    reconcile=reconcile_module_record,
    ensure_operational=ensure_module_operational,
    record_status=_module_record_status,
))
configure_role_grants(module_role_grants)


from ..api.auth import AUTH_ATTEMPTS, AUTH_RATE_LIMIT_MAX_KEYS, auth_rate_key, rate_limit_auth
from ..api.errors import uok_request_validation_error_handler
from ..api.auth import router as auth_router
from ..api.commands import router as commands_router
from ..api.system import router as system_router
from ..api.schemas import (
    CommandRequest,
    LoginRequest,
    RegisterRequest,
)
from ..config import env_flag
from ..kernel.persistence import Base
from ..seed import seed
from .database import SessionLocal, database_pool_telemetry, engine
from .http_security import (
    build_http_security_settings,
    fastapi_docs_urls,
    install_http_security,
)
from .module_routers import mount_module_routers

APP_TITLE = "UOK"
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
REACT_APP_INDEX = STATIC_DIR / "app" / "index.html"


def bootstrap() -> str:
    ensure_module_models_registered()
    if env_flag("UOK_AUTO_CREATE_SCHEMA"):
        Base.metadata.create_all(bind=engine)
    if not env_flag("UOK_SEED_LOCAL_DATA"):
        return ""
    with SessionLocal() as db:
        return seed(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        bootstrap()
        yield
    finally:
        engine.dispose()


http_security_settings = build_http_security_settings()
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    lifespan=lifespan,
    **fastapi_docs_urls(http_security_settings),
)
install_http_security(app, http_security_settings)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.exception_handler(PermissionError)
def permission_error_handler(_: Request, exc: PermissionError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": f"Permission denied: {exc}"})


@app.exception_handler(SQLAlchemyTimeoutError)
def database_pool_timeout_handler(_: Request, __: SQLAlchemyTimeoutError) -> JSONResponse:
    database_pool_telemetry.record_timeout()
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection pool is temporarily unavailable"},
        headers={"Retry-After": "1"},
    )


app.add_exception_handler(RequestValidationError, uok_request_validation_error_handler)


@app.get("/")
def index() -> FileResponse:
    if not REACT_APP_INDEX.exists():
        raise HTTPException(status_code=503, detail="React frontend build is missing. Run npm run build:static from web/.")
    return FileResponse(REACT_APP_INDEX)


app.include_router(auth_router)
app.include_router(commands_router)
app.include_router(system_router)
mount_module_routers(app)

__all__ = [
    "AUTH_ATTEMPTS",
    "AUTH_RATE_LIMIT_MAX_KEYS",
    "CommandRequest",
    "LoginRequest",
    "RegisterRequest",
    "app",
    "auth_rate_key",
    "bootstrap",
    "env_flag",
    "rate_limit_auth",
]
