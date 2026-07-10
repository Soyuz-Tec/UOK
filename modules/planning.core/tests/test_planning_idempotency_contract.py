from __future__ import annotations

import json
from pathlib import Path

from uok.main import app


WRITE_METHODS = {"post", "put", "patch", "delete"}
PLANNING_MUTATIONS = {
    ("post", "/api/planning/projects"),
    ("post", "/api/planning/projects/{project_id}/tasks"),
    ("patch", "/api/planning/tasks/{task_id}"),
    ("delete", "/api/planning/tasks/{task_id}"),
    ("post", "/api/planning/projects/{project_id}/dependencies"),
    ("patch", "/api/planning/dependencies/{dependency_id}"),
    ("delete", "/api/planning/dependencies/{dependency_id}"),
    ("put", "/api/planning/projects/{project_id}/calendar"),
    ("post", "/api/planning/projects/{project_id}/baselines"),
    ("post", "/api/planning/projects/{project_id}/resources"),
    ("post", "/api/planning/assignments"),
    ("post", "/api/planning/projects/{project_id}/mutations:batch"),
}
BATCH_MUTATION = ("post", "/api/planning/projects/{project_id}/mutations:batch")
CONDITIONAL_MUTATIONS = PLANNING_MUTATIONS - {("post", "/api/planning/projects")}
READ_ONLY_POST_OPERATIONS: set[tuple[str, str]] = set()


def test_idempotency_contract_matches_runtime_and_generated_openapi() -> None:
    runtime_schema = app.openapi()
    generated_schema = json.loads(Path("web/src/generated/openapi.json").read_text(encoding="utf-8"))
    write_shaped_operations = {
        (method, path)
        for path, path_item in runtime_schema["paths"].items()
        if path.startswith("/api/planning/")
        for method in path_item
        if method in WRITE_METHODS
    }

    assert write_shaped_operations == PLANNING_MUTATIONS | READ_ONLY_POST_OPERATIONS
    for schema_name, schema in (("runtime", runtime_schema), ("generated", generated_schema)):
        assert_conflict_schema(schema)
        assert_precondition_schema(schema)
        assert_domain_error_schema(schema)
        assert_planning_mutation_contract(schema_name, schema)
        assert_command_contract(schema)
        assert_schedule_read_contract(schema)
        assert_baseline_read_contract(schema)


def assert_planning_mutation_contract(schema_name: str, schema: dict[str, object]) -> None:
    paths = schema["paths"]
    for method, path in PLANNING_MUTATIONS:
        operation = paths[path][method]
        parameters = operation.get("parameters", [])
        header = next(
            (
                parameter
                for parameter in parameters
                if parameter.get("in") == "header" and parameter.get("name") == "Idempotency-Key"
            ),
            None,
        )
        assert header is not None, f"{schema_name} {method.upper()} {path} omits Idempotency-Key"
        assert header["required"] is True
        assert header["schema"]["minLength"] == 16
        assert header["schema"]["maxLength"] == 128
        assert header["schema"]["pattern"] == r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"
        assert_conflict_response(operation)
        assert operation["responses"]["200"]["headers"]["ETag"]["schema"]["type"] == "string"
        if (method, path) in CONDITIONAL_MUTATIONS:
            if_match = next(
                (
                    parameter
                    for parameter in parameters
                    if parameter.get("in") == "header" and parameter.get("name") == "If-Match"
                ),
                None,
            )
            assert if_match is not None, f"{schema_name} {method.upper()} {path} omits If-Match"
            assert if_match["required"] is False
            assert_precondition_responses(operation, include_bad_request=(method, path) != BATCH_MUTATION)
        if (method, path) == BATCH_MUTATION:
            assert operation["responses"]["400"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/CommandDomainErrorResponse"
            request = operation["requestBody"]["content"]["application/json"]["schema"]
            assert request["$ref"] == "#/components/schemas/PlanningBatchRequest"
            batch_schema = schema["components"]["schemas"]["PlanningBatchRequest"]
            assert batch_schema["properties"]["operations"]["maxItems"] == 500


def assert_command_contract(schema: dict[str, object]) -> None:
    command_operation = schema["paths"]["/api/commands"]["post"]
    command_schema = schema["components"]["schemas"]["CommandRequest"]
    key_schema = command_schema["properties"]["idempotency_key"]
    assert_conflict_response(command_operation)
    assert_precondition_responses(command_operation)
    if_match = next(parameter for parameter in command_operation["parameters"] if parameter["name"] == "If-Match")
    assert if_match["required"] is False
    assert "idempotency_key" in command_schema["required"]
    assert key_schema["minLength"] == 16
    assert key_schema["maxLength"] == 128
    assert key_schema["pattern"] == r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"


def assert_conflict_response(operation: dict[str, object]) -> None:
    response = operation["responses"]["409"]
    schema = response["content"]["application/json"]["schema"]
    assert schema["$ref"] == "#/components/schemas/IdempotencyConflictResponse"


def assert_conflict_schema(schema: dict[str, object]) -> None:
    components = schema["components"]["schemas"]
    response = components["IdempotencyConflictResponse"]
    detail = components["IdempotencyConflictDetail"]
    assert response["required"] == ["detail"]
    assert response["properties"]["detail"]["$ref"] == "#/components/schemas/IdempotencyConflictDetail"
    assert detail["required"] == ["error"]
    assert detail["properties"]["error"]["type"] == "string"


def assert_precondition_responses(operation: dict[str, object], include_bad_request: bool = True) -> None:
    if include_bad_request:
        response = operation["responses"]["400"]
        schema = response["content"]["application/json"]["schema"]
        assert schema["$ref"] == "#/components/schemas/CommandPreconditionResponse"
    for status in ("412", "428"):
        response = operation["responses"][status]
        schema = response["content"]["application/json"]["schema"]
        assert schema["$ref"] == "#/components/schemas/CommandPreconditionResponse"


def assert_precondition_schema(schema: dict[str, object]) -> None:
    components = schema["components"]["schemas"]
    response = components["CommandPreconditionResponse"]
    detail = components["CommandPreconditionDetail"]
    assert response["required"] == ["error"]
    assert response["properties"]["error"]["$ref"] == "#/components/schemas/CommandPreconditionDetail"
    assert set(detail["required"]) == {
        "code",
        "message",
        "repair",
        "current_revision",
        "current_etag",
        "object_ids",
        "reload_url",
    }


def assert_domain_error_schema(schema: dict[str, object]) -> None:
    components = schema["components"]["schemas"]
    response = components["CommandDomainErrorResponse"]
    detail = components["CommandDomainErrorDetail"]
    assert response["required"] == ["error"]
    assert response["properties"]["error"]["$ref"] == "#/components/schemas/CommandDomainErrorDetail"
    assert set(detail["required"]) == {"code", "message", "object_ids", "repair"}


def assert_schedule_read_contract(schema: dict[str, object]) -> None:
    response = schema["paths"]["/api/planning/projects/{project_id}/schedule"]["get"]["responses"]["200"]
    assert response["headers"]["ETag"]["schema"]["type"] == "string"


def assert_baseline_read_contract(schema: dict[str, object]) -> None:
    paths = schema["paths"]
    assert "/api/planning/projects/{project_id}/baselines/{baseline_id}" in paths
    comparison = paths["/api/planning/projects/{project_id}/baselines/compare"]["get"]
    parameters = {(item["name"], item["in"]): item for item in comparison["parameters"]}
    assert parameters[("left_baseline_id", "query")]["required"] is True
    assert parameters[("right_baseline_id", "query")]["required"] is True
