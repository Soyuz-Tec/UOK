import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactFilters } from "../../web/src/contracts";
import { useContactData } from "../../web/src/app/useContactData";

const filters: ContactFilters = {
  query: "",
  contactGroupId: "",
  statusFilter: "",
  reviewFilter: "all",
  typeFilter: "all",
  sourceFilter: "all",
  qualityFilter: "all",
  contactPage: 0,
  contactPageSize: 25,
  contactSortBy: "display_name",
  contactSortDir: "asc",
};

describe("useContactData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("refreshes owner-local reads when the neutral host revision changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.startsWith("/api/contacts?")
        ? [{ id: "contact-1", display_name: "Supplier One" }]
        : path === "/api/contacts/groups"
          ? []
          : { id: "contact-1", display_name: "Supplier One" };
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "1" },
        json: async () => body,
      } as unknown as Response);
    });
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();
    const contactListCalls = () => fetchMock.mock.calls
      .filter(([input]) => String(input).startsWith("/api/contacts?"))
      .length;
    const { rerender } = renderHook(
      ({ revision }) => useContactData("test-token", true, filters, revision, onUnauthorized),
      { initialProps: { revision: 0 } },
    );

    await waitFor(() => expect(contactListCalls()).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });
    const before = contactListCalls();

    rerender({ revision: 1 });

    await waitFor(() => expect(contactListCalls()).toBeGreaterThan(before));
  });
});
