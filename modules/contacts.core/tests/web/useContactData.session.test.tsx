import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactData } from "../../web/src/app/useContactData";
import {
  contactA,
  contactARevision,
  contactB,
  contactFilters,
  contactsHost,
  createContactReadRouter,
  groupA,
  groupB,
  jsonResponse,
  resolveResponse,
  tenantBContact,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts primary-read session authority", () => {
  it("rejects non-abortable same-token generation ABA completions", async () => {
    const router = createContactReadRouter();
    const firstList = router.defer("list");
    const firstGroups = router.defer("groups");
    const middleList = router.defer("list");
    const middleGroups = router.defer("groups");
    const currentList = router.defer("list");
    const currentGroups = router.defer("groups");
    const currentDetail = router.defer(`detail:${contactARevision.id}`);
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const base = contactsHost({
      session: { token: "stable-token", generation: 0, onUnauthorized },
    });
    const { result, rerender } = renderHook(
      ({ host }) => useContactData(host, true, contactFilters()),
      { initialProps: { host: base } },
    );

    rerender({ host: {
      ...base,
      session: { ...base.session, generation: 1 },
    } });
    rerender({ host: {
      ...base,
      session: { ...base.session, generation: 2 },
    } });
    expect(result.current.contacts).toEqual([]);
    expect(result.current.contactGroups).toEqual([]);
    expect(router.callsFor("list").map((call) => call.signal?.aborted))
      .toEqual([true, true, false]);

    await resolveResponse(currentList, jsonResponse([contactARevision], 200, 1));
    await resolveResponse(currentGroups, jsonResponse([groupB]));
    await resolveResponse(currentDetail, jsonResponse(contactARevision));
    expect(result.current.selectedContact).toEqual(contactARevision);

    await resolveResponse(firstList, jsonResponse([contactA], 200, 90));
    await resolveResponse(firstGroups, jsonResponse([groupA]));
    await resolveResponse(middleList, jsonResponse({ detail: "stale" }, 401));
    await resolveResponse(middleGroups, jsonResponse([groupA]));

    expect(result.current.contacts).toEqual([contactARevision]);
    expect(result.current.contactGroups).toEqual([groupB]);
    expect(result.current.contactTotalCount).toBe(1);
    expect(result.current.selectedContact).toEqual(contactARevision);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("prevents tenant A data from crossing logout and tenant B login", async () => {
    const router = createContactReadRouter();
    const tenantAList = router.defer("list");
    const tenantAGroups = router.defer("groups");
    const tenantBList = router.defer("list");
    const tenantBGroups = router.defer("groups");
    const tenantBDetail = router.defer(`detail:${tenantBContact.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const base = contactsHost({ session: { token: "tenant-a", generation: 0 } });
    const { result, rerender } = renderHook(
      ({ host }) => useContactData(host, true, contactFilters()),
      { initialProps: { host: base } },
    );

    rerender({ host: contactsHost({
      session: { token: "", generation: 1 },
    }) });
    expect(result.current.contacts).toEqual([]);
    expect(router.callsFor("list")).toHaveLength(1);
    rerender({ host: contactsHost({
      session: { token: "tenant-b", generation: 2 },
    }) });

    await resolveResponse(tenantBList, jsonResponse([tenantBContact], 200, 1));
    await resolveResponse(tenantBGroups, jsonResponse([groupB]));
    await resolveResponse(tenantBDetail, jsonResponse(tenantBContact));
    await resolveResponse(tenantAList, jsonResponse([contactA], 200, 80));
    await resolveResponse(tenantAGroups, jsonResponse([groupA]));

    expect(result.current.contacts).toEqual([tenantBContact]);
    expect(result.current.contactGroups).toEqual([groupB]);
    expect(result.current.selectedContact).toEqual(tenantBContact);
    expect(router.callsFor("list").map((call) => call.authorization))
      .toEqual(["Bearer tenant-a", "Bearer tenant-b"]);
  });

  it("suppresses stale role-transition 401 and privileged success", async () => {
    const router = createContactReadRouter();
    const privilegedList = router.defer("list");
    const privilegedGroups = router.defer("groups");
    const viewerList = router.defer("list");
    const viewerGroups = router.defer("groups");
    const viewerDetail = router.defer(`detail:${contactB.id}`);
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const base = contactsHost({
      currentUserRole: "ops_manager",
      session: { onUnauthorized },
    });
    const { result, rerender } = renderHook(
      ({ host }) => useContactData(host, true, contactFilters()),
      { initialProps: { host: base } },
    );
    rerender({ host: { ...base, currentUserRole: "viewer" } });

    await resolveResponse(privilegedList, jsonResponse([contactA], 200, 99));
    await resolveResponse(
      privilegedGroups,
      jsonResponse({ detail: "old role" }, 401),
    );
    await resolveResponse(viewerList, jsonResponse([contactB], 200, 1));
    await resolveResponse(viewerGroups, jsonResponse([groupB]));
    await resolveResponse(viewerDetail, jsonResponse(contactB));

    expect(result.current.contacts).toEqual([contactB]);
    expect(result.current.selectedContact).toEqual(contactB);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("handles simultaneous current list, group, and detail 401s exactly once", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const staleGroups = router.defer("groups");
    const detail = router.defer(`detail:${contactA.id}`);
    const list = router.defer("list");
    const groups = router.defer("groups");
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost({ session: { onUnauthorized } }),
      true,
      contactFilters(),
    ));
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    expect(result.current.contacts).toEqual([contactA]);
    act(() => {
      void result.current.refresh();
    });

    await Promise.all([
      resolveResponse(list, jsonResponse({ detail: "expired list" }, 401)),
      resolveResponse(groups, jsonResponse({ detail: "expired groups" }, 401)),
      resolveResponse(detail, jsonResponse({ detail: "expired detail" }, 401)),
    ]);
    await resolveResponse(staleGroups, jsonResponse([groupA]));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.contacts).toEqual([]);
    expect(result.current.contactGroups).toEqual([]);
    expect(result.current.selectedContact).toBeNull();
  });
});
