from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import APP_VERSION
from .module_contract_validation import validate_module_runtime_contracts


runtime_contract = validate_module_runtime_contracts()
if not runtime_contract["ok"]:
    raise RuntimeError(f"Module runtime contract is invalid: {runtime_contract['violations']}")


from .api.auth import AUTH_ATTEMPTS, AUTH_RATE_LIMIT_MAX_KEYS, auth_rate_key, rate_limit_auth
from .api.errors import uok_request_validation_error_handler
from .api.auth import router as auth_router
from .api.commands import router as commands_router
from .api.system import router as system_router
from .api.schemas import (
    CommandRequest,
    ContactCsvImportRequest,
    ContactNoteRequest,
    ContactRelationshipRequest,
    ContactWriteRequest,
    LoginRequest,
    RegisterRequest,
)
from .config import env_flag
from .db import Base, SessionLocal, engine
from .module_routers import mount_module_routers
from .seed import seed

APP_TITLE = "UOK"
STATIC_DIR = Path(__file__).parent / "static"
REACT_APP_INDEX = STATIC_DIR / "app" / "index.html"


def bootstrap() -> str:
    if env_flag("UOK_AUTO_CREATE_SCHEMA"):
        Base.metadata.create_all(bind=engine)
    if not env_flag("UOK_SEED_LOCAL_DATA"):
        return ""
    with SessionLocal() as db:
        return seed(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap()
    yield


app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.exception_handler(PermissionError)
def permission_error_handler(_: Request, exc: PermissionError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": f"Permission denied: {exc}"})


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
    "ContactCsvImportRequest",
    "ContactNoteRequest",
    "ContactRelationshipRequest",
    "ContactWriteRequest",
    "LoginRequest",
    "RegisterRequest",
    "app",
    "auth_rate_key",
    "bootstrap",
    "env_flag",
    "rate_limit_auth",
]
