import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactReadApiError } from "../../web/src/app/contactReadApi";
import { getContactRelationshipOptions } from "../../web/src/contactRelationshipOptionsApi";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts relationship-options read API", () => {
  it("normalizes criteria and sends captured authority context", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([optionA]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getContactRelationshipOptions(
      "lookup-token",
      "  alpha beta  ",
      "party/with spaces",
      { onUnauthorized: vi.fn(), signal: controller.signal },
    )).resolves.toEqual([optionA]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contacts/relationship-options?query=alpha+beta"
        + "&exclude_party_id=party%2Fwith+spaces&limit=20",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer lookup-token",
        },
        signal: controller.signal,
      },
    );
  });

  it("rejects malformed success and preserves an API-specific failure", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({}, 503)));

    await expect(getContactRelationshipOptions(
      "token", "alpha", "party-a", { onUnauthorized: vi.fn() },
    )).rejects.toThrow("Contact lookup response is invalid.");
    await expect(getContactRelationshipOptions(
      "token", "alpha", "party-a", { onUnauthorized: vi.fn() },
    )).rejects.toMatchObject({
      message: "Unable to search contacts.",
      status: 503,
    });
  });

  it("delegates a 401 only through the supplied guarded callback", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ detail: "lookup session expired" }, 401),
    ));

    await expect(getContactRelationshipOptions(
      "token", "alpha", "party-a", { onUnauthorized },
    )).rejects.toBeInstanceOf(ContactReadApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

const optionA = {
  id: "party-b",
  display_name: "Contact Beta",
  party_type: "person",
  email: "beta@example.test",
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
