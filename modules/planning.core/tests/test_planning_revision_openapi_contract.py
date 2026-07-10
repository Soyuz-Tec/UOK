from __future__ import annotations

import json
from pathlib import Path

from uok.main import app


def test_revision_history_contract_matches_runtime_and_generated_openapi() -> None:
    generated = json.loads(Path("web/src/generated/openapi.json").read_text(encoding="utf-8"))
    for schema in (app.openapi(), generated):
        _assert_revision_history_contract(schema)


def _assert_revision_history_contract(schema: dict[str, object]) -> None:
    paths = schema["paths"]
    list_path = "/api/planning/projects/{project_id}/revisions"
    detail_path = "/api/planning/projects/{project_id}/revisions/{revision_number}"
    assert paths[list_path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningRevisionPage"
    assert paths[detail_path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/PlanningRevisionMetadata"
    list_parameters = {row["name"]: row for row in paths[list_path]["get"]["parameters"]}
    assert list_parameters["limit"]["schema"]["maximum"] == 200
    assert list_parameters["offset"]["schema"]["maximum"] == 10_000
    revision = schema["components"]["schemas"]["PlanningRevisionMetadata"]
    outbox = schema["components"]["schemas"]["PlanningOutboxMetadata"]
    assert revision["additionalProperties"] is False
    assert outbox["additionalProperties"] is False
    assert {"actor_user_id", "payload_json"}.isdisjoint(revision["properties"])
    assert "payload_json" not in outbox["properties"]
    assert revision["properties"]["outbox"]["$ref"] == "#/components/schemas/PlanningOutboxMetadata"
    assert set(outbox["required"]) == {"id", "event_type", "schema_version", "checksum", "created_at"}
