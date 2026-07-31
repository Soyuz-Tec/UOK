import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContactReadApiError,
  contactReadErrorMessage,
  loadContactDetail,
  loadContactGroups,
  loadContacts,
} from "../../web/src/app/contactReadApi";
import {
  contactA,
  contactB,
  contactFilters,
  groupA,
  jsonResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts primary-read API", () => {
  it("encodes every list criterion and returns bounded pagination metadata", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      [contactA, contactB, { ...contactB, id: "overflow" }],
      200,
      10,
    ));
    vi.stubGlobal("fetch", fetchMock);
    const filters = contactFilters({
      query: "alpha beta",
      contactGroupId: "group-a",
      statusFilter: "archived",
      reviewFilter: "needs_review",
      typeFilter: "organization",
      sourceFilter: "gmail",
      qualityFilter: "duplicate_risk",
      contactPage: 1,
      contactPageSize: 2,
      contactSortBy: "display_name",
      contactSortDir: "asc",
    });

    const result = await loadContacts("read-token", filters, {
      onUnauthorized: vi.fn(),
      signal: controller.signal,
    });

    expect(result).toEqual({
      rows: [contactA, contactB],
      totalCount: 10,
      hasNext: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contacts?query=alpha+beta&group_id=group-a&status=archived"
        + "&review_state=needs_review&party_type=organization&source=gmail"
        + "&quality=duplicate_risk&limit=3&offset=2"
        + "&sort_by=display_name&sort_dir=asc",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer read-token",
        },
        signal: controller.signal,
      },
    );
  });

  it("loads groups and an encoded Party detail with the captured signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([groupA]))
      .mockResolvedValueOnce(jsonResponse(contactA));
    vi.stubGlobal("fetch", fetchMock);
    const request = {
      onUnauthorized: vi.fn(),
      signal: controller.signal,
    };

    await expect(loadContactGroups("token", request)).resolves.toEqual([groupA]);
    await expect(loadContactDetail("token", "party/with spaces", request))
      .resolves.toEqual(contactA);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/contacts/groups",
      "/api/contacts/party%2Fwith%20spaces",
    ]);
    expect(fetchMock.mock.calls.every(([, options]) =>
      (options as RequestInit).signal === controller.signal)).toBe(true);
  });

  it.each([
    ["list", () => loadContacts("token", contactFilters(), {
      onUnauthorized: vi.fn(),
    }), {}],
    ["groups", () => loadContactGroups("token", {
      onUnauthorized: vi.fn(),
    }), {}],
    ["detail", () => loadContactDetail("token", contactA.id, {
      onUnauthorized: vi.fn(),
    }), []],
  ])("rejects a malformed %s payload", async (_name, request, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body)));
    await expect(request()).rejects.toBeInstanceOf(ContactReadApiError);
  });

  it("delegates only a supplied 401 callback and preserves server errors", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ detail: "session expired" }, 401),
    ));

    await expect(loadContactGroups("token", { onUnauthorized })).rejects
      .toMatchObject({ message: "session expired", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(contactReadErrorMessage({
      detail: { message: "nested denial" },
    })).toBe("nested denial");
  });
});
