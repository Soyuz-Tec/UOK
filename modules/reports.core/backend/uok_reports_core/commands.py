from __future__ import annotations

from typing import Any, Callable

from pydantic import ValidationError
from sqlalchemy.orm import Session

from uok.security import Actor

from .schemas import GenerateReportRequest
from .service import delete_report_artifact, generate_report, verify_report_artifact

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]


def cmd_generate_report(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    try:
        request = GenerateReportRequest.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid report request")) from exc
    return generate_report(db, actor, request, command_id)


def cmd_delete_report_artifact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    artifact_id = str(payload.get("artifact_id") or "").strip()
    if not artifact_id:
        raise ValueError("artifact_id is required")
    return delete_report_artifact(db, actor, artifact_id)


def cmd_verify_report_artifact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    artifact_id = str(payload.get("artifact_id") or "").strip()
    if not artifact_id:
        raise ValueError("artifact_id is required")
    return verify_report_artifact(db, actor, artifact_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "GenerateReport": cmd_generate_report,
        "DeleteReportArtifact": cmd_delete_report_artifact,
        "VerifyReportArtifact": cmd_verify_report_artifact,
    }


def command_permissions() -> dict[str, str]:
    return {
        "GenerateReport": "reports.render",
        "DeleteReportArtifact": "reports.delete",
        "VerifyReportArtifact": "reports.manage",
    }
