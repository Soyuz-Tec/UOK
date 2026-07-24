from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.module_runtime import ensure_module_operational
from uok.models_base import new_id, utcnow
from uok.kernel.security import Actor, require_permission
from uok.util import dumps, loads

from . import MODULE_NAME
from .audit import emit_report_event
from .formats import render_report
from .models import ReportArtifact
from .schemas import GenerateReportRequest, MAX_PAYLOAD_BYTES, ReportArtifactResponse
from .storage import delete_report_file, safe_filename_base, save_report_bytes, storage_path

MAX_ARTIFACT_BYTES = 10_000_000


def generate_report(db: Session, actor: Actor, request: GenerateReportRequest, command_id: str | None = None) -> dict[str, Any]:
    require_permission(actor, "reports.render")
    ensure_module_operational(db, actor.organization_id, MODULE_NAME)
    payload_json = dumps(request.payload)
    if len(payload_json.encode("utf-8")) > MAX_PAYLOAD_BYTES:
        raise ValueError(f"report payload exceeds {MAX_PAYLOAD_BYTES} bytes")
    artifacts: list[dict[str, Any]] = []
    for report_format in request.formats:
        rendered = render_report(request, report_format)
        if len(rendered.content) > MAX_ARTIFACT_BYTES:
            raise ValueError(f"generated {report_format} artifact exceeds {MAX_ARTIFACT_BYTES} bytes")
        artifact_id = new_id()
        content_hash = sha256(rendered.content).hexdigest()
        storage_key, byte_size = save_report_bytes(actor.organization_id, artifact_id, rendered.extension, rendered.content)
        filename = _filename_for(request, artifact_id, rendered.extension)
        record = ReportArtifact(
            id=artifact_id,
            organization_id=actor.organization_id,
            created_by_user_id=actor.user_id,
            source_module=request.source_module,
            template_key=request.template_key,
            artifact_kind="report",
            format=rendered.format,
            filename=filename,
            media_type=rendered.media_type,
            storage_key=storage_key,
            content_sha256=content_hash,
            byte_size=byte_size,
            status="generated",
            metadata_json=dumps({
                "command_id": command_id,
                "renderer": "uok.safe_core",
                "payload_sha256": sha256(payload_json.encode("utf-8")).hexdigest(),
            }),
        )
        db.add(record)
        db.flush()
        emit_report_event(db, actor, "ReportGenerated", artifact_id, {
            "format": rendered.format,
            "source_module": request.source_module,
            "template_key": request.template_key,
            "byte_size": byte_size,
        })
        artifacts.append(artifact_response(record))
    return {"artifacts": artifacts, "artifact_count": len(artifacts)}


def get_report_artifact(db: Session, actor: Actor, artifact_id: str) -> ReportArtifact:
    require_permission(actor, "reports.read")
    record = db.scalar(select(ReportArtifact).where(
        ReportArtifact.organization_id == actor.organization_id,
        ReportArtifact.id == artifact_id,
    ))
    if not record or record.deleted_at is not None:
        raise ValueError("report artifact not found")
    return record


def report_artifact_path(db: Session, actor: Actor, artifact_id: str) -> tuple[ReportArtifact, Path]:
    record = get_report_artifact(db, actor, artifact_id)
    path = storage_path(record.storage_key)
    if not path.exists():
        raise ValueError("report artifact file is missing")
    return record, path


def delete_report_artifact(db: Session, actor: Actor, artifact_id: str) -> dict[str, Any]:
    require_permission(actor, "reports.delete")
    record = get_report_artifact(db, actor, artifact_id)
    delete_report_file(record.storage_key)
    record.status = "deleted"
    record.deleted_at = utcnow()
    emit_report_event(db, actor, "ReportArtifactDeleted", artifact_id, {"format": record.format})
    return artifact_response(record)


def verify_report_artifact(db: Session, actor: Actor, artifact_id: str) -> dict[str, Any]:
    require_permission(actor, "reports.manage")
    record, path = report_artifact_path(db, actor, artifact_id)
    current_hash = sha256(path.read_bytes()).hexdigest()
    ok = current_hash == record.content_sha256
    emit_report_event(db, actor, "ReportArtifactVerified", artifact_id, {"ok": ok})
    return {"ok": ok, "artifact": artifact_response(record), "current_sha256": current_hash}


def artifact_response(record: ReportArtifact) -> dict[str, Any]:
    response = ReportArtifactResponse(
        id=record.id,
        source_module=record.source_module,
        template_key=record.template_key,
        artifact_kind=record.artifact_kind,
        format=record.format,
        filename=record.filename,
        media_type=record.media_type,
        content_sha256=record.content_sha256,
        byte_size=record.byte_size,
        status=record.status,
        metadata=loads(record.metadata_json, {}),
        created_at=record.created_at.isoformat(),
        deleted_at=record.deleted_at.isoformat() if record.deleted_at else None,
    )
    return response.model_dump()


def _filename_for(request: GenerateReportRequest, artifact_id: str, extension: str) -> str:
    base = request.filename_base or request.title or request.template_key
    safe_base = safe_filename_base(base)
    return f"{safe_base}-{artifact_id[:8]}.{extension}"
