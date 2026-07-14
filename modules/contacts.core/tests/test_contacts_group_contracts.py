from __future__ import annotations

from uuid import uuid4

from sqlalchemy import event
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import engine


def test_contact_group_list_uses_a_bounded_query_count(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text
    empty_group_ids: set[str] = set()
    for index in range(12):
        created = command(
            client,
            ops,
            "CreateContactGroup",
            {"name": f"Query Budget Group {index} {suffix}"},
            f"uok-contact-group-query-budget-{index}-{suffix}",
        )
        assert created.status_code == 200, created.text
        empty_group_ids.add(created.json()["result"]["id"])

    statements: list[str] = []

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _executemany) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture_statement)
    try:
        response = client.get("/api/contacts/groups", headers=ops)
    finally:
        event.remove(engine, "before_cursor_execute", capture_statement)
    assert response.status_code == 200, response.text
    select_count = sum(1 for statement in statements if statement.lstrip().upper().startswith("SELECT"))
    assert select_count <= 5, statements

    nonempty_manual = client.get(
        "/api/contacts/groups",
        headers=ops,
        params={"kind": "manual", "include_empty": "false"},
    )
    assert nonempty_manual.status_code == 200, nonempty_manual.text
    assert all(row["kind"] == "manual" for row in nonempty_manual.json())
    assert empty_group_ids.isdisjoint({row["id"] for row in nonempty_manual.json()})


def test_generated_contact_group_kinds_require_their_generators(client: TestClient) -> None:
    suffix = str(uuid4())
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install = client.post("/api/modules/contacts.core/install", headers=admin)
    assert install.status_code == 200, install.text

    generated = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Direct Generated Group {suffix}", "kind": "smart_rule"},
        f"uok-contact-group-direct-generated-{suffix}",
    )
    assert generated.status_code == 400, generated.text
    assert "created by their generator" in generated.text

    invalid = command(
        client,
        ops,
        "CreateContactGroup",
        {"name": f"Invalid Group {suffix}", "kind": "unsupported"},
        f"uok-contact-group-invalid-kind-{suffix}",
    )
    assert invalid.status_code == 400, invalid.text
    assert "business_domain, manual, smart_rule" in invalid.text
