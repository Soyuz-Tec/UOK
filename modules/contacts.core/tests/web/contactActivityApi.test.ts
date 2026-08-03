import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactReadApiError } from "../../web/src/app/contactReadApi";
import { getContactActivity } from "../../web/src/contactActivityApi";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts activity read API", () => {
  it("encodes the Party, sends captured authority context, and accepts a safe total", async () => {
    const controller = new AbortController();
    const response = activityResponse([activityA], 200, "12");
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getContactActivity(
      "activity-token",
      "party/with spaces",
      25,
      50,
      { onUnauthorized: vi.fn(), signal: controller.signal },
    )).resolves.toEqual({ items: [activityA], totalCount: 12 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contacts/party%2Fwith%20spaces/activity?limit=25&offset=50",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer activity-token",
        },
        signal: controller.signal,
      },
    );
  });

  it.each([null, "", "NaN", "-1", "0", "1.5"])(
    "falls back to the visible row count for an unsafe total header %s",
    async (totalCount) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
        activityResponse([activityA, activityB], 200, totalCount),
      ));
      await expect(getContactActivity(
        "token",
        "party-a",
        10,
        0,
        { onUnauthorized: vi.fn() },
      )).resolves.toMatchObject({ totalCount: 2 });
    },
  );

  it("rejects malformed success and preserves an API-specific failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      activityResponse({ items: [] }),
    ).mockResolvedValueOnce(
      activityResponse({}, 503),
    ));

    await expect(getContactActivity(
      "token", "party-a", 10, 0, { onUnauthorized: vi.fn() },
    )).rejects.toThrow("Contacts activity response is invalid.");
    await expect(getContactActivity(
      "token", "party-a", 10, 0, { onUnauthorized: vi.fn() },
    )).rejects.toMatchObject({
      message: "Unable to load contact activity.",
      status: 503,
    });
  });

  it("delegates a 401 only through the supplied guarded callback", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      activityResponse({ detail: { error: "session expired" } }, 401),
    ));

    await expect(getContactActivity(
      "token", "party-a", 10, 0, { onUnauthorized },
    )).rejects.toBeInstanceOf(ContactReadApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

const activityA = {
  id: "activity-a",
  party_id: "party-a",
  activity_type: "updated",
  object_type: "party",
  object_id: "party-a",
  summary: "Updated",
  occurred_at: "2026-07-31T08:00:00Z",
};
const activityB = { ...activityA, id: "activity-b" };

function activityResponse(
  value: unknown,
  status = 200,
  totalCount: string | null = null,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (totalCount !== null) headers.set("X-Total-Count", totalCount);
  return new Response(JSON.stringify(value), { headers, status });
}
