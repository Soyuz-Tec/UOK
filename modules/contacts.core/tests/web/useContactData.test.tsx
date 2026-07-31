import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useContactData } from "../../web/src/app/useContactData";
import { contactFilters, contactsHost } from "./ContactReadTestUtils";

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
      ({ revision }) => useContactData(
        contactsHost({
          moduleRefreshRevision: revision,
          session: { onUnauthorized },
        }),
        true,
        contactFilters(),
      ),
      { initialProps: { revision: 0 } },
    );

    await waitFor(() => expect(contactListCalls()).toBeGreaterThan(0));
    const before = contactListCalls();

    rerender({ revision: 1 });

    await waitFor(() => expect(contactListCalls()).toBeGreaterThan(before));
  });
});
