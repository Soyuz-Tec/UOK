from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id


def _install(client: TestClient):
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    trader = auth(client, "trader", "trader123")
    installed = client.post("/api/modules/contacts.core/install", headers=admin)
    assert installed.status_code == 200, installed.text
    return ops, trader


def test_fact_mutations_rebuild_legacy_search_and_export_projections(client: TestClient) -> None:
    suffix = str(uuid4())
    ops, _ = _install(client)
    old_email = f"projection-{suffix}@example.test"
    created = command(
        client,
        ops,
        "CreateContact",
        {
            "display_name": f"Projection Contact {suffix}",
            "email": old_email,
            "birthday": "1984-03-12",
            "important_date": "2026-07-08",
        },
        f"projection-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]
    facts = client.get(f"/api/contacts/{party_id}/facts", headers=ops).json()
    email_fact = next(row for row in facts if row["fact_type"] == "email")
    birthday_fact = next(row for row in facts if row["fact_type"] == "date" and row["label"] == "birthday")
    important_fact = next(row for row in facts if row["fact_type"] == "date" and row["label"] == "important")

    changed = client.patch(
        f"/api/contacts/{party_id}/facts/{email_fact['id']}",
        headers=ops,
        json={
            "fact_type": "phone",
            "label": "work",
            "value": "+1 202 555 0199",
            "is_primary": True,
        },
    )
    assert changed.status_code == 200, changed.text
    detail = client.get(f"/api/contacts/{party_id}", headers=ops).json()
    assert detail["email"] == ""
    assert detail["phone"] == "+12025550199"
    search = client.get("/api/contacts", headers=ops, params={"query": old_email, "status": "all"})
    assert party_id not in {row["id"] for row in search.json()}
    exported = client.get("/api/contacts/export.csv", headers=ops, params={"party_id": party_id})
    assert old_email not in exported.text
    assert "+12025550199" in exported.text

    removed_birthday = client.delete(
        f"/api/contacts/{party_id}/facts/{birthday_fact['id']}",
        headers=ops,
    )
    assert removed_birthday.status_code == 200, removed_birthday.text
    detail = client.get(f"/api/contacts/{party_id}", headers=ops).json()
    assert detail["birthday"] == ""
    assert detail["important_date"] == "2026-07-08"

    removed_important = client.delete(
        f"/api/contacts/{party_id}/facts/{important_fact['id']}",
        headers=ops,
    )
    assert removed_important.status_code == 200, removed_important.text
    detail = client.get(f"/api/contacts/{party_id}", headers=ops).json()
    assert detail["birthday"] == ""
    assert detail["important_date"] == ""


def test_archived_contact_team_membership_does_not_grant_access(client: TestClient) -> None:
    suffix = str(uuid4())
    ops, trader = _install(client)
    team = command(
        client,
        ops,
        "CreateContactTeam",
        {"name": f"Archive Access Team {suffix}"},
        f"archive-team-{suffix}",
    )
    assert team.status_code == 200, team.text
    team_id = team.json()["result"]["id"]
    member = command(
        client,
        ops,
        "AddContactTeamMember",
        {"team_id": team_id, "user_id": user_id("trader"), "role": "member"},
        f"archive-team-member-{suffix}",
    )
    assert member.status_code == 200, member.text
    display_name = f"Archived Team Contact {suffix}"
    created = command(
        client,
        ops,
        "CreateContact",
        {"display_name": display_name, "team_id": team_id, "visibility_scope": "team"},
        f"archive-team-contact-{suffix}",
    )
    assert created.status_code == 200, created.text
    party_id = created.json()["result"]["contact_id"]
    assert client.get(f"/api/contacts/{party_id}", headers=trader).status_code == 200

    archived = client.post(f"/api/contacts/teams/{team_id}/archive", headers=ops)
    assert archived.status_code == 200, archived.text
    assert client.get(f"/api/contacts/{party_id}", headers=trader).status_code == 403
    rows = client.get("/api/contacts", headers=trader, params={"query": display_name, "status": "all"})
    assert party_id not in {row["id"] for row in rows.json()}


def test_generic_custom_field_command_enforces_definition_contract(client: TestClient) -> None:
    suffix = str(uuid4()).replace("-", "_")
    ops, _ = _install(client)
    invalid_cases = (
        ({"field_key": "x", "label": "Short key", "field_type": "text", "applies_to": "all", "options": []}, "key must match"),
        ({"field_key": "Invalid_Key", "label": "Uppercase key", "field_type": "text", "applies_to": "all", "options": []}, "key must match"),
        ({"label": "", "field_type": "text", "applies_to": "all", "options": []}, "label is required"),
        ({"label": "Invalid type", "field_type": "currency", "applies_to": "all", "options": []}, "type must be one of"),
        ({"label": "Invalid target", "field_type": "text", "applies_to": "company", "options": []}, "applies_to must be one of"),
        ({"label": "Invalid options", "field_type": "choice", "applies_to": "all", "options": "standard"}, "options must be a list"),
        ({"label": "Too many options", "field_type": "choice", "applies_to": "all", "options": [str(index) for index in range(101)]}, "100 entries or fewer"),
    )
    for index, (payload, message) in enumerate(invalid_cases):
        rejected = command(
            client,
            ops,
            "DefineContactCustomField",
            {"field_key": f"invalid_{index}_{suffix}", **payload},
            f"invalid-custom-field-{index}-{suffix}",
        )
        assert rejected.status_code == 400, rejected.text
        assert message in rejected.text

    accepted = command(
        client,
        ops,
        "DefineContactCustomField",
        {
            "field_key": f"valid_{suffix}",
            "label": "Account tier",
            "field_type": "choice",
            "applies_to": "organization",
            "options": ["standard", "preferred"],
        },
        f"valid-custom-field-{suffix}",
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["result"]["field_type"] == "choice"


def test_duplicate_refresh_retires_pairs_with_archived_contacts(client: TestClient) -> None:
    suffix = str(uuid4())
    ops, _ = _install(client)
    email = f"active-only-{suffix}@example.test"
    left = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Active Duplicate Left {suffix}", "email": email},
        f"active-duplicate-left-{suffix}",
    ).json()["result"]["contact_id"]
    right = command(
        client,
        ops,
        "CreateContact",
        {"display_name": f"Active Duplicate Right {suffix}", "email": email},
        f"active-duplicate-right-{suffix}",
    ).json()["result"]["contact_id"]
    refreshed = client.post("/api/contacts/duplicate-candidates/refresh", headers=ops)
    assert refreshed.status_code == 200, refreshed.text
    candidates = client.get("/api/contacts/duplicate-candidates", headers=ops).json()
    candidate = next(row for row in candidates if {row["left_party_id"], row["right_party_id"]} == {left, right})

    archived = command(
        client,
        ops,
        "ArchiveContact",
        {"party_id": right},
        f"archive-duplicate-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    refreshed = client.post("/api/contacts/duplicate-candidates/refresh", headers=ops)
    assert refreshed.status_code == 200, refreshed.text
    open_ids = {row["id"] for row in client.get("/api/contacts/duplicate-candidates", headers=ops).json()}
    stale_ids = {
        row["id"]
        for row in client.get(
            "/api/contacts/duplicate-candidates",
            headers=ops,
            params={"status": "stale"},
        ).json()
    }
    assert candidate["id"] not in open_ids
    assert candidate["id"] in stale_ids
