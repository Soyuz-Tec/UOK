import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactData } from "../../web/src/app/useContactData";
import {
  contactA,
  contactB,
  contactFilters,
  contactsHost,
  createContactReadRouter,
  groupA,
  groupB,
  jsonResponse,
  resolveResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts retained-surface and lifecycle read authority", () => {
  it("masks hidden work and reloads once on activation", async () => {
    const router = createContactReadRouter();
    const hiddenList = router.defer("list");
    const hiddenGroups = router.defer("groups");
    const activeList = router.defer("list");
    const activeGroups = router.defer("groups");
    const activeDetail = router.defer(`detail:${contactB.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const base = contactsHost();
    const { result, rerender } = renderHook(
      ({ host }) => useContactData(host, true, contactFilters()),
      { initialProps: { host: base } },
    );

    rerender({ host: {
      ...base,
      appearance: "dark",
      moduleRefreshRevision: 1,
      surfaceActive: false,
    } });
    expect(result.current.contacts).toEqual([]);
    expect(router.callsFor("list")).toHaveLength(1);
    expect(router.callsFor("list")[0]?.signal?.aborted).toBe(true);

    rerender({ host: {
      ...base,
      appearance: "light",
      moduleRefreshRevision: 2,
      surfaceActive: false,
    } });
    expect(router.callsFor("list")).toHaveLength(1);
    rerender({ host: {
      ...base,
      appearance: "light",
      moduleRefreshRevision: 2,
      surfaceActive: true,
    } });
    expect(router.callsFor("list")).toHaveLength(2);

    await resolveResponse(hiddenList, jsonResponse([contactA], 200, 70));
    await resolveResponse(hiddenGroups, jsonResponse([groupA]));
    expect(result.current.contacts).toEqual([]);
    await resolveResponse(activeList, jsonResponse([contactB], 200, 1));
    await resolveResponse(activeGroups, jsonResponse([groupB]));
    await resolveResponse(activeDetail, jsonResponse(contactB));
    expect(result.current.contacts).toEqual([contactB]);
    expect(result.current.selectedContact).toEqual(contactB);
  });

  it("invalidates reads across operational disable and re-enable", async () => {
    const router = createContactReadRouter();
    const staleList = router.defer("list");
    const staleGroups = router.defer("groups");
    const currentList = router.defer("list");
    const currentGroups = router.defer("groups");
    const currentDetail = router.defer(`detail:${contactB.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const host = contactsHost();
    const { result, rerender } = renderHook(
      ({ operational }) => useContactData(host, operational, contactFilters()),
      { initialProps: { operational: true } },
    );

    rerender({ operational: false });
    expect(result.current.contacts).toEqual([]);
    expect(router.callsFor("list")[0]?.signal?.aborted).toBe(true);
    await resolveResponse(staleList, jsonResponse([contactA], 200, 50));
    await resolveResponse(staleGroups, jsonResponse([groupA]));
    expect(result.current.contacts).toEqual([]);

    rerender({ operational: true });
    await resolveResponse(currentList, jsonResponse([contactB], 200, 1));
    await resolveResponse(currentGroups, jsonResponse([groupB]));
    await resolveResponse(currentDetail, jsonResponse(contactB));
    expect(result.current.contacts).toEqual([contactB]);
    expect(result.current.contactGroups).toEqual([groupB]);
  });

  it("disposes every pending lane and late 401 on unmount", async () => {
    const router = createContactReadRouter();
    const list = router.defer("list");
    const groups = router.defer("groups");
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const { unmount } = renderHook(() => useContactData(
      contactsHost({ session: { onUnauthorized } }),
      true,
      contactFilters(),
    ));
    unmount();

    expect(router.calls.every((call) => call.signal?.aborted)).toBe(true);
    await resolveResponse(list, jsonResponse({ detail: "late list" }, 401));
    await resolveResponse(groups, jsonResponse({ detail: "late groups" }, 401));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("refreshes active list/groups without restarting same-revision detail", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const initialGroups = router.defer("groups");
    const detail = router.defer(`detail:${contactA.id}`);
    const refreshedList = router.defer("list");
    const refreshedGroups = router.defer("groups");
    vi.stubGlobal("fetch", router.fetchMock);
    const base = contactsHost();
    const { result, rerender } = renderHook(
      ({ host }) => useContactData(host, true, contactFilters()),
      { initialProps: { host: base } },
    );
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    await resolveResponse(initialGroups, jsonResponse([groupA]));
    expect(router.callsFor(`detail:${contactA.id}`)).toHaveLength(1);

    rerender({ host: { ...base, appearance: "dark" } });
    expect(router.callsFor("list")).toHaveLength(1);
    expect(router.callsFor(`detail:${contactA.id}`)[0]?.signal?.aborted).toBe(false);
    rerender({ host: {
      ...base,
      appearance: "dark",
      moduleRefreshRevision: 1,
    } });
    expect(router.callsFor("list")).toHaveLength(2);
    expect(router.callsFor("groups")).toHaveLength(2);
    expect(router.callsFor(`detail:${contactA.id}`)).toHaveLength(1);

    await resolveResponse(refreshedList, jsonResponse([contactA], 200, 1));
    await resolveResponse(refreshedGroups, jsonResponse([groupA]));
    await resolveResponse(detail, jsonResponse(contactA));
    expect(result.current.selectedContact).toEqual(contactA);
  });
});
