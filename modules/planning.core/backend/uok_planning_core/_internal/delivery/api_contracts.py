from __future__ import annotations

from uok.api.schemas import CommandDomainErrorResponse, CommandPreconditionResponse

ETAG_RESPONSE_HEADERS = {
    "ETag": {
        "description": "Quoted strong SHA-256 validator for the actor-visible Planning schedule.",
        "schema": {"type": "string"},
    }
}
IDEMPOTENCY_CONFLICT_RESPONSE = {
    409: {"model": CommandDomainErrorResponse, "description": "Idempotency key conflicts with another Planning request."},
    403: {"model": CommandDomainErrorResponse, "description": "The actor lacks the required Planning capability."},
    422: {"model": CommandDomainErrorResponse, "description": "The Planning request does not match the generated contract."},
}
PLANNING_CREATE_RESPONSES = {
    **IDEMPOTENCY_CONFLICT_RESPONSE,
    200: {"description": "Project created at revision 1.", "headers": ETAG_RESPONSE_HEADERS},
    400: {"model": CommandDomainErrorResponse, "description": "The Planning project proposal is invalid."},
}
PLANNING_MUTATION_RESPONSES = {
    **IDEMPOTENCY_CONFLICT_RESPONSE,
    400: {
        "description": "The Planning proposal or If-Match validator is invalid.",
        "content": {"application/json": {"schema": {"oneOf": [
            {"$ref": "#/components/schemas/CommandPreconditionResponse"},
            {"$ref": "#/components/schemas/CommandDomainErrorResponse"},
        ]}}},
    },
    200: {"description": "Mutation accepted and committed once.", "headers": ETAG_RESPONSE_HEADERS},
    412: {"model": CommandPreconditionResponse, "description": "The supplied strong ETag is stale; reload and explicitly reapply or keep the current schedule."},
    428: {"model": CommandPreconditionResponse, "description": "A current strong Planning ETag is required."},
}
PLANNING_BATCH_RESPONSES = {
    **PLANNING_MUTATION_RESPONSES,
    400: {"model": CommandDomainErrorResponse, "description": "A batch operation or the final proposed schedule is invalid."},
}

__all__ = ["ETAG_RESPONSE_HEADERS", "PLANNING_BATCH_RESPONSES", "PLANNING_CREATE_RESPONSES", "PLANNING_MUTATION_RESPONSES"]
