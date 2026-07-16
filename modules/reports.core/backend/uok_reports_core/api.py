from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.security import Actor, require_permission

from .schemas import GenerateReportRequest, ReportFormatResponse, SUPPORTED_REPORT_FORMATS
from .service import (
    artifact_response,
    delete_report_artifact,
    generate_report,
    get_report_artifact,
    report_artifact_path,
    verify_report_artifact,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/formats")
def formats(actor: Actor = Depends(current_actor)) -> dict[str, object]:
    require_permission(actor, "reports.read")
    return ReportFormatResponse(
        formats=list(SUPPORTED_REPORT_FORMATS),
        default_format="json",
        security_model="structured payloads only; no raw HTML, shell commands, or arbitrary URLs",
    ).model_dump()


@router.post("/generate")
def generate(req: GenerateReportRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        result = generate_report(db, actor, req)
        db.commit()
        return result
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/artifacts/{artifact_id}")
def artifact(artifact_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return artifact_response(get_report_artifact(db, actor, artifact_id))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get("/artifacts/{artifact_id}/download")
def download(artifact_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> FileResponse:
    try:
        record, path = report_artifact_path(db, actor, artifact_id)
        return FileResponse(path, media_type=record.media_type, filename=record.filename)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.delete("/artifacts/{artifact_id}")
def delete(artifact_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        result = delete_report_artifact(db, actor, artifact_id)
        db.commit()
        return result
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.post("/artifacts/{artifact_id}/verify")
def verify(artifact_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        result = verify_report_artifact(db, actor, artifact_id)
        db.commit()
        return result
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc
