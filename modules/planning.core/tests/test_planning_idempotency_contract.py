from __future__ import annotations

import json
from pathlib import Path

from uok_planning_core.batch_schemas import PlanningBatchRequest
from uok.main import app


WRITE_METHODS = {"post", "put", "patch", "delete"}
PLANNING_MUTATIONS = {
    ("post", "/api/planning/projects"),
    ("post", "/api/planning/projects/{project_id}/transitions"),
    ("post", "/api/planning/projects/{project_id}/tasks"),
    ("patch", "/api/planning/tasks/{task_id}"),
    ("patch", "/api/planning/tasks/{task_id}/dates"),
    ("post", "/api/planning/tasks/{task_id}/participants"),
    ("delete", "/api/planning/tasks/{task_id}/participants/{participant_id}"),
    ("post", "/api/planning/tasks/{task_id}/requirements"),
    ("post", "/api/planning/tasks/{task_id}/requirements/{requirement_id}/advance"),
    ("put", "/api/planning/tasks/{task_id}/requirements/{requirement_id}/link"),
    ("post", "/api/planning/tasks/{task_id}/requirements/{requirement_id}/decision"),
    ("delete", "/api/planning/tasks/{task_id}"),
    ("post", "/api/planning/projects/{project_id}/dependencies"),
    ("patch", "/api/planning/dependencies/{dependency_id}"),
    ("delete", "/api/planning/dependencies/{dependency_id}"),
    ("put", "/api/planning/projects/{project_id}/calendar"),
    ("post", "/api/planning/projects/{project_id}/baselines"),
    ("post", "/api/planning/projects/{project_id}/resources"),
    ("put", "/api/planning/projects/{project_id}/resources/{resource_id}/calendar"),
    ("post", "/api/planning/assignments"),
    ("post", "/api/planning/projects/{project_id}/mutations:batch"),
    ("post", "/api/planning/projects/{project_id}/links"),
    ("post", "/api/planning/projects/{project_id}/what-if-snapshots"),
    ("post", "/api/planning/projects/{project_id}/risk-analyses"),
    ("post", "/api/planning/projects/{project_id}/optimizations"),
    ("post", "/api/planning/projects/{project_id}/recommendations/{recommendation_id}/decision"),
    ("post", "/api/planning/projects/{project_id}/recommendations/{recommendation_id}/apply"),
    ("post", "/api/planning/projects/{project_id}/recommendations/{recommendation_id}/rollback"),
    ("delete", "/api/planning/projects/{project_id}/links/{link_id}"),
}
BATCH_MUTATION = ("post", "/api/planning/projects/{project_id}/mutations:batch")
SUPPORTED_BATCH_KINDS = {
    "update_task", "create_dependency", "update_dependency", "remove_dependency", "assign_resource",
    "unassign_resource", "set_calendar", "create_link", "remove_link", "transition_gate",
}
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
        assert_precondition_schema(schema)
        assert_domain_error_schema(schema)
        assert_planning_mutation_contract(schema_name, schema)
        assert_command_contract(schema)
        assert_schedule_read_contract(schema)
        assert_baseline_read_contract(schema)
        assert_capability_read_contract(schema)
        assert_link_contract(schema)
        assert_date_semantics_contract(schema)
        assert_participant_contract(schema)
        assert_requirement_contract(schema)


def test_batch_contract_preserves_explicit_null_task_fields_without_materializing_unset_defaults() -> None:
    request = PlanningBatchRequest.model_validate({
        "operations": [{
            "operation_id": "clear-parent",
            "kind": "update_task",
            "payload": {"task_id": "task-1", "parent_task_id": None, "constraint_date": None},
        }]
    })

    payload = request.model_dump(exclude_unset=True)["operations"][0]["payload"]
    assert payload["parent_task_id"] is None
    assert payload["constraint_date"] is None
    assert "title" not in payload


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
        assert_domain_response(operation, "403")
        assert_domain_response(operation, "422")
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
            assert_planning_precondition_responses(operation, include_bad_request=(method, path) != BATCH_MUTATION)
        if (method, path) == BATCH_MUTATION:
            assert operation["responses"]["400"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/CommandDomainErrorResponse"
            request = operation["requestBody"]["content"]["application/json"]["schema"]
            assert request["$ref"] == "#/components/schemas/PlanningBatchRequest"
            batch_schema = schema["components"]["schemas"]["PlanningBatchRequest"]
            assert batch_schema["properties"]["operations"]["maxItems"] == 500
            assert_batch_operation_union(schema, batch_schema)
            source_command = next(item for item in batch_schema["properties"]["source_command_id"]["anyOf"] if item.get("type") == "string")
            assert source_command["minLength"] == source_command["maxLength"] == 36


def assert_batch_operation_union(schema: dict[str, object], batch_schema: dict[str, object]) -> None:
    items = batch_schema["properties"]["operations"]["items"]
    assert items["discriminator"]["propertyName"] == "kind"
    assert set(items["discriminator"]["mapping"]) == SUPPORTED_BATCH_KINDS
    operation_schemas = [schema["components"]["schemas"][row["$ref"].rsplit("/", 1)[-1]] for row in items["oneOf"]]
    assert {row["properties"]["kind"]["const"] for row in operation_schemas} == SUPPORTED_BATCH_KINDS
    for operation in operation_schemas:
        assert operation["additionalProperties"] is False
        payload_name = operation["properties"]["payload"]["$ref"].rsplit("/", 1)[-1]
        assert schema["components"]["schemas"][payload_name]["additionalProperties"] is False


def assert_command_contract(schema: dict[str, object]) -> None:
    command_operation = schema["paths"]["/api/commands"]["post"]
    command_schema = schema["components"]["schemas"]["CommandRequest"]
    key_schema = command_schema["properties"]["idempotency_key"]
    assert_conflict_response(command_operation)
    assert_precondition_responses(command_operation)
    assert_domain_response(command_operation, "403")
    assert_domain_response(command_operation, "422")
    if_match = next(parameter for parameter in command_operation["parameters"] if parameter["name"] == "If-Match")
    assert if_match["required"] is False
    assert "idempotency_key" in command_schema["required"]
    assert key_schema["minLength"] == 16
    assert key_schema["maxLength"] == 128
    assert key_schema["pattern"] == r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"


def assert_conflict_response(operation: dict[str, object]) -> None:
    assert_domain_response(operation, "409")


def assert_domain_response(operation: dict[str, object], status: str) -> None:
    response = operation["responses"][status]
    schema = response["content"]["application/json"]["schema"]
    assert schema["$ref"] == "#/components/schemas/CommandDomainErrorResponse"


def assert_planning_precondition_responses(operation: dict[str, object], include_bad_request: bool = True) -> None:
    if include_bad_request:
        schema = operation["responses"]["400"]["content"]["application/json"]["schema"]
        assert schema["oneOf"] == [
            {"$ref": "#/components/schemas/CommandPreconditionResponse"},
            {"$ref": "#/components/schemas/CommandDomainErrorResponse"},
        ]
    assert_precondition_responses(operation, include_bad_request=False)


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
    assert response["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningScheduleReadModel"
    schedule = schema["components"]["schemas"]["PlanningScheduleReadModel"]
    task_flow = schema["components"]["schemas"]["PlanningTaskFlowContract"]
    status = schema["components"]["schemas"]["PlanningTaskFlowStatus"]
    assert schedule["required"] == ["task_flow"]
    assert task_flow["required"] == ["schema_version", "statuses"]
    assert task_flow["properties"]["schema_version"]["const"] == 1
    assert status["additionalProperties"] is False
    assert set(status["required"]) == {"status", "display_label", "allowed_transitions"}
    assert status["properties"]["status"]["enum"] == ["planned", "in_progress", "blocked", "complete"]
    assert status["properties"]["allowed_transitions"]["items"]["enum"] == ["planned", "in_progress", "blocked", "complete"]


def assert_baseline_read_contract(schema: dict[str, object]) -> None:
    paths = schema["paths"]
    assert "/api/planning/projects/{project_id}/baselines/{baseline_id}" in paths
    comparison = paths["/api/planning/projects/{project_id}/baselines/compare"]["get"]
    parameters = {(item["name"], item["in"]): item for item in comparison["parameters"]}
    assert parameters[("left_baseline_id", "query")]["required"] is True
    assert parameters[("right_baseline_id", "query")]["required"] is True


def assert_capability_read_contract(schema: dict[str, object]) -> None:
    operation = schema["paths"]["/api/planning/capabilities"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["additionalProperties"]["type"] == "boolean"


def assert_link_contract(schema: dict[str, object]) -> None:
    operation = schema["paths"]["/api/planning/projects/{project_id}/links"]["post"]
    request = operation["requestBody"]["content"]["application/json"]["schema"]
    assert request["$ref"] == "#/components/schemas/PlanningLinkRequest"
    target = schema["components"]["schemas"]["PlanningLinkTargetRequest"]
    assert target["additionalProperties"] is False
    assert set(target["properties"]["kind"]["enum"]) == {
        "operation", "gate", "evidence", "party", "shipment", "document", "location", "asset",
        "agreement", "communication_thread", "calendar_event",
    }


def assert_date_semantics_contract(schema: dict[str, object]) -> None:
    operation = schema["paths"]["/api/planning/tasks/{task_id}/dates"]["patch"]
    request = operation["requestBody"]["content"]["application/json"]["schema"]
    assert request["$ref"] == "#/components/schemas/PlanningTaskDateUpdateRequest"
    date_request = schema["components"]["schemas"]["PlanningTaskDateUpdateRequest"]
    assert date_request["additionalProperties"] is False
    for field in ("forecast_start", "forecast_end", "actual_start", "actual_end", "deadline"):
        value = next(item for item in date_request["properties"][field]["anyOf"] if item.get("type") == "string")
        assert value["minLength"] == value["maxLength"] == 10


def assert_participant_contract(schema: dict[str, object]) -> None:
    operation = schema["paths"]["/api/planning/tasks/{task_id}/participants"]["post"]
    request = operation["requestBody"]["content"]["application/json"]["schema"]
    assert request["$ref"] == "#/components/schemas/PlanningTaskParticipantRequest"
    participant = schema["components"]["schemas"]["PlanningTaskParticipantRequest"]
    assert participant["additionalProperties"] is False
    assert set(participant["required"]) == {"party_id", "role"}
    assert "external_contact" in participant["properties"]["role"]["pattern"]


def assert_requirement_contract(schema: dict[str, object]) -> None:
    paths = schema["paths"]
    create = paths["/api/planning/tasks/{task_id}/requirements"]["post"]
    advance = paths["/api/planning/tasks/{task_id}/requirements/{requirement_id}/advance"]["post"]
    decision = paths["/api/planning/tasks/{task_id}/requirements/{requirement_id}/decision"]["post"]
    link = paths["/api/planning/tasks/{task_id}/requirements/{requirement_id}/link"]["put"]
    assert create["requestBody"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningTaskRequirementRequest"
    assert advance["requestBody"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningTaskRequirementAdvanceRequest"
    assert decision["requestBody"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningTaskRequirementDecisionRequest"
    assert link["requestBody"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningTaskRequirementLinkRequest"
    requirement = schema["components"]["schemas"]["PlanningTaskRequirementRequest"]
    assert requirement["additionalProperties"] is False
    assert set(requirement["required"]) == {"requirement_type", "title"}
    assert "shipment" in requirement["properties"]["requirement_type"]["pattern"]
    assert schema["components"]["schemas"]["PlanningTaskRequirementLinkRequest"]["required"] == ["target_link_id"]
    assert schema["components"]["schemas"]["PlanningTaskRequirementDecisionRequest"]["properties"]["reason"]["maxLength"] == 500
