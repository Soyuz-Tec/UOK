import { afterEach, describe, expect, it, vi } from "vitest";

import { addPlanningTaskParticipant, loadPlanningPartyOptions, removePlanningTaskParticipant, type PlanningStrongEtag } from "../../web/src/planningApi";

const etag1 = strongEtag(1, "a");
const etag2 = strongEtag(2, "b");

afterEach(() => vi.unstubAllGlobals());

describe("Planning participant API", () => {
  it("loads canonical parties and sends typed participant add/remove mutations", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: "party-1", display_name: "Owner", status: "active" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "participant-1", role: "owner" }, 200, etag2))
      .mockResolvedValueOnce(jsonResponse({ id: "participant-1", removed: true }, 200, etag1));
    vi.stubGlobal("fetch", fetchMock);

    await loadPlanningPartyOptions("token");
    await addPlanningTaskParticipant("token", "task-1", { party_id: "party-1", role: "owner" }, { ifMatch: etag1, idempotencyKey: "planning-participant-add-1" });
    await removePlanningTaskParticipant("token", "task-1", "participant-1", { ifMatch: etag2, idempotencyKey: "planning-participant-remove-1" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/contacts?status=active&limit=200&sort_by=display_name&sort_dir=asc");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/planning/tasks/task-1/participants");
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({ party_id: "party-1", role: "owner" });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/planning/tasks/task-1/participants/participant-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});

function jsonResponse(value: unknown, status = 200, etag?: PlanningStrongEtag) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (etag) headers.set("ETag", etag);
  return new Response(JSON.stringify(value), { status, headers });
}

function strongEtag(revision: number, character: string) {
  return `"planning-r${revision}-sha256-${character.repeat(64)}"` as PlanningStrongEtag;
}
