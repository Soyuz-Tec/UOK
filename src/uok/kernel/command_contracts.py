from __future__ import annotations

from typing import Any


COMMAND_IF_MATCH_CONTEXT_KEY = "_uok_if_match"
COMMAND_ETAG_RESULT_KEY = "_uok_response_etag"
MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH = 16
MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH = 128
MAX_IDEMPOTENCY_KEY_LENGTH = 180


class CommandDomainError(ValueError):
    """Carries a stable, transport-neutral command validation contract."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = 400,
        field: str | None = None,
        object_ids: list[str] | None = None,
        repair: str,
        current_revision: int | None = None,
        correlation_id: str | None = None,
        attach_correlation: bool = True,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.field = field
        self.object_ids = object_ids or []
        self.repair = repair
        self.current_revision = current_revision
        self.correlation_id = correlation_id
        self.attach_correlation = attach_correlation

    def response_body(self) -> dict[str, object]:
        return {
            "error": {
                "code": self.code,
                "message": str(self),
                "field": self.field,
                "object_ids": self.object_ids,
                "repair": self.repair,
                "current_revision": self.current_revision,
                "correlation_id": self.correlation_id,
            }
        }


class CommandPermissionError(PermissionError):
    """Carries a denied command's stable error envelope and audit identity."""

    def __init__(self, permission: str, correlation_id: str, object_ids: list[str] | None = None) -> None:
        super().__init__(f"Permission denied: {permission}")
        self.code = "permission_denied"
        self.status_code = 403
        self.field = None
        self.object_ids = object_ids or []
        self.repair = "Request the required server capability from an administrator, then retry the original intent."
        self.current_revision = None
        self.correlation_id = correlation_id

    def response_body(self) -> dict[str, object]:
        return {
            "error": {
                "code": self.code,
                "message": str(self),
                "field": self.field,
                "object_ids": self.object_ids,
                "repair": self.repair,
                "current_revision": self.current_revision,
                "correlation_id": self.correlation_id,
            }
        }


class CommandPreconditionError(ValueError):
    """Carries an HTTP-independent optimistic-concurrency recovery contract."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        repair: str,
        current_revision: int,
        current_etag: str,
        object_ids: list[str],
        reload_url: str,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.repair = repair
        self.current_revision = current_revision
        self.current_etag = current_etag
        self.object_ids = object_ids
        self.reload_url = reload_url
        self.field = "If-Match"
        self.correlation_id: str | None = None

    def response_body(self) -> dict[str, object]:
        return {
            "error": {
                "code": self.code,
                "message": str(self),
                "field": self.field,
                "repair": self.repair,
                "current_revision": self.current_revision,
                "current_etag": self.current_etag,
                "object_ids": self.object_ids,
                "reload_url": self.reload_url,
                "correlation_id": self.correlation_id,
            }
        }


class IdempotencyConflictError(CommandDomainError):
    """Raised when one idempotency key is reused for different command content."""

    def __init__(
        self,
        correlation_id: str | None = None,
        object_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            code="idempotency_conflict",
            message="idempotency_key is already used for a different command request",
            status_code=409,
            field="idempotency_key",
            object_ids=object_ids,
            repair="Retry the original payload with this key, or use a new key for a different intent.",
            correlation_id=correlation_id,
        )


def clean_command_text(value: Any) -> str:
    return str(value or "").strip()


__all__ = [
    "COMMAND_ETAG_RESULT_KEY",
    "COMMAND_IF_MATCH_CONTEXT_KEY",
    "MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH",
    "MAX_IDEMPOTENCY_KEY_LENGTH",
    "MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH",
    "CommandDomainError",
    "CommandPermissionError",
    "CommandPreconditionError",
    "IdempotencyConflictError",
    "clean_command_text",
]
