import { afterEach, describe, expect, it, vi } from "vitest";

import {
  advancePlanningTaskRequirement,
  createPlanningTaskRequirement,
  decidePlanningTaskRequirement,
  setPlanningTaskRequirementLink,
  type PlanningStrongEtag,
} from "../../web/src/planningApi";

const etag1 = strongEtag(1, "a");
const etag2 = strongEtag(2, "b");
const etag3 = strongEtag(3, "c");

afterEach(() => vi.unstubAllGlobals());

describe("Planning requirements API", () => {
  it("sends typed create, advance, and decision mutations with strong preconditions", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "requirement-1", state: "missing" }, etag2))
      .mockResolvedValueOnce(jsonResponse({ id: "requirement-1", state: "submitted" }, etag3))
      .mockResolvedValueOnce(jsonResponse({ id: "requirement-1", target_link_id: "link-1" }, etag1))
      .mockResolvedValueOnce(jsonResponse({ id: "requirement-1", state: "satisfied" }, etag1));
    vi.stubGlobal("fetch", fetchMock);

    await createPlanningTaskRequirement(
      "token",
      "task-1",
      { requirement_type: "evidence", title: "Signed evidence", target_link_id: "link-1" },
      { ifMatch: etag1, idempotencyKey: "planning-requirement-create-1" },
    );
    await advancePlanningTaskRequirement(
      "token",
      "task-1",
      "requirement-1",
      { action: "submit" },
      { ifMatch: etag2, idempotencyKey: "planning-requirement-advance-1" },
    );
    await setPlanningTaskRequirementLink(
      "token",
      "task-1",
      "requirement-1",
      { target_link_id: "link-1" },
      { ifMatch: etag3, idempotencyKey: "planning-requirement-link-1" },
    );
    await decidePlanningTaskRequirement(
      "token",
      "task-1",
      "requirement-1",
      { decision: "satisfy", reason: "Reviewed" },
      { ifMatch: etag1, idempotencyKey: "planning-requirement-decision-1" },
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/planning/tasks/task-1/requirements",
      "/api/planning/tasks/task-1/requirements/requirement-1/advance",
      "/api/planning/tasks/task-1/requirements/requirement-1/link",
      "/api/planning/tasks/task-1/requirements/requirement-1/decision",
    ]);
    expect(request(fetchMock, 0)).toMatchObject({ method: "POST" });
    expect(new Headers(request(fetchMock, 2).headers).get("If-Match")).toBe(etag3);
    expect(JSON.parse(String(request(fetchMock, 3).body))).toEqual({ decision: "satisfy", reason: "Reviewed" });
  });
});

function request(mock: ReturnType<typeof vi.fn>, index: number) {
  return mock.mock.calls[index][1] as RequestInit;
}

function jsonResponse(value: unknown, etag: PlanningStrongEtag) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json", ETag: etag } });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}
