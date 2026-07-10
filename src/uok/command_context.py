from __future__ import annotations

COMMAND_IF_MATCH_CONTEXT_KEY = "_uok_if_match"
COMMAND_ETAG_RESULT_KEY = "_uok_response_etag"


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

    def response_body(self) -> dict[str, object]:
        return {
            "error": {
                "code": self.code,
                "message": str(self),
                "repair": self.repair,
                "current_revision": self.current_revision,
                "current_etag": self.current_etag,
                "object_ids": self.object_ids,
                "reload_url": self.reload_url,
            }
        }


__all__ = ["COMMAND_ETAG_RESULT_KEY", "COMMAND_IF_MATCH_CONTEXT_KEY", "CommandPreconditionError"]
