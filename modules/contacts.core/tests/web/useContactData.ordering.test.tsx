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
} from "./ContactReadTestUtils";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts primary-read lane ordering", () => {
  it("commits list and groups independently", async () => {
    const router = createContactReadRouter();
    const list = router.defer("list");
    const groups = router.defer("groups");
    const detail = router.defer(`detail:${contactA.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(),
      true,
      contactFilters(),
    ));

    await resolveResponse(list, jsonResponse([contactA], 200, 1));
    expect(result.current.contacts).toEqual([contactA]);
    expect(result.current.contactGroups).toEqual([]);
    await resolveResponse(groups, jsonResponse({ detail: "groups down" }, 503));
    expect(result.current.contacts).toEqual([contactA]);
    expect(result.current.contactGroups).toEqual([]);
    await resolveResponse(detail, jsonResponse(contactA));
    expect(result.current.selectedContact).toEqual(contactA);
  });

  it("keeps only the newest same-criteria refresh and pagination state", async () => {
    const router = createContactReadRouter();
    const staleList = router.defer("list");
    const staleGroups = router.defer("groups");
    const currentList = router.defer("list");
    const currentGroups = router.defer("groups");
    const currentDetail = router.defer(`detail:${contactB.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(),
      true,
      contactFilters({ contactPageSize: 1 }),
    ));
    act(() => {
      void result.current.refresh();
    });
    expect(router.callsFor("list")[0]?.signal?.aborted).toBe(true);
    expect(router.callsFor("groups")[0]?.signal?.aborted).toBe(true);

    await resolveResponse(staleList, jsonResponse([contactA], 200, 90));
    await resolveResponse(staleGroups, jsonResponse([groupA]));
    expect(result.current.contacts).toEqual([]);
    expect(result.current.contactGroups).toEqual([]);
    expect(result.current.busyAction).toBe("refresh");

    await resolveResponse(currentList, jsonResponse([contactB], 200, 1));
    await resolveResponse(currentGroups, jsonResponse([groupB]));
    await resolveResponse(currentDetail, jsonResponse(contactB));

    expect(result.current.contacts).toEqual([contactB]);
    expect(result.current.contactGroups).toEqual([groupB]);
    expect(result.current.contactTotalCount).toBe(1);
    expect(result.current.contactHasNext).toBe(false);
    expect(result.current.selectedContactId).toBe(contactB.id);
  });

  it("invalidates a filter A to B to A before the debounce dispatches", async () => {
    vi.useFakeTimers();
    const router = createContactReadRouter();
    const originalList = router.defer("list");
    const groups = router.defer("groups");
    vi.stubGlobal("fetch", router.fetchMock);
    const host = contactsHost();
    const { result, rerender, unmount } = renderHook(
      ({ filters }) => useContactData(host, true, filters),
      { initialProps: { filters: contactFilters({ query: "alpha" }) } },
    );
    rerender({ filters: contactFilters({ query: "beta" }) });
    rerender({ filters: contactFilters({ query: "alpha" }) });
    expect(router.callsFor("list")).toHaveLength(1);
    expect(router.callsFor("list")[0]?.signal?.aborted).toBe(true);

    await resolveResponse(originalList, jsonResponse([contactA], 200, 70));
    await resolveResponse(groups, jsonResponse([groupA]));
    expect(result.current.contacts).toEqual([]);
    expect(result.current.contactGroups).toEqual([groupA]);
    unmount();
  });

  it("rejects original A and B details across selection A to B to A", async () => {
    const router = createContactReadRouter();
    const list = router.defer("list");
    const groups = router.defer("groups");
    const originalA = router.defer(`detail:${contactA.id}`);
    const b = router.defer(`detail:${contactB.id}`);
    const currentA = router.defer(`detail:${contactA.id}`);
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost({ session: { onUnauthorized } }),
      true,
      contactFilters(),
    ));
    await resolveResponse(list, jsonResponse([contactA, contactB], 200, 2));
    await resolveResponse(groups, jsonResponse([groupA]));
    act(() => result.current.setSelectedContactId(contactB.id));
    expect(result.current.selectedContact?.id).toBe(contactB.id);
    act(() => result.current.setSelectedContactId(contactA.id));

    await resolveResponse(originalA, jsonResponse({ detail: "stale A" }, 401));
    await resolveResponse(b, jsonResponse({ ...contactB, email: "stale-b@test" }));
    await resolveResponse(currentA, jsonResponse({
      ...contactA,
      email: "current-a@test",
    }));

    expect(result.current.selectedContact?.email).toBe("current-a@test");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("supersedes detail when the selected row revision changes", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const initialGroups = router.defer("groups");
    const staleDetail = router.defer(`detail:${contactA.id}`);
    const refreshedList = router.defer("list");
    const refreshedGroups = router.defer("groups");
    const currentDetail = router.defer(`detail:${contactA.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(),
      true,
      contactFilters(),
    ));
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    await resolveResponse(initialGroups, jsonResponse([groupA]));
    act(() => {
      void result.current.refresh();
    });
    await resolveResponse(refreshedList, jsonResponse([contactARevision], 200, 1));
    await resolveResponse(refreshedGroups, jsonResponse([groupA]));
    expect(router.callsFor(`detail:${contactA.id}`)[0]?.signal?.aborted).toBe(true);

    await resolveResponse(currentDetail, jsonResponse(contactARevision));
    await resolveResponse(staleDetail, jsonResponse(contactA));
    expect(result.current.selectedContact).toEqual(contactARevision);
  });

  it("clears prior detail on a current denial without logging out", async () => {
    const router = createContactReadRouter();
    const list = router.defer("list");
    const groups = router.defer("groups");
    const aDetail = router.defer(`detail:${contactA.id}`);
    const bDetail = router.defer(`detail:${contactB.id}`);
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost({ session: { onUnauthorized } }),
      true,
      contactFilters(),
    ));
    await resolveResponse(list, jsonResponse([contactA, contactB], 200, 2));
    await resolveResponse(groups, jsonResponse([groupA]));
    await resolveResponse(aDetail, jsonResponse({
      ...contactA,
      email: "privileged-alpha@example.test",
    }));
    expect(result.current.selectedContact?.email)
      .toBe("privileged-alpha@example.test");

    act(() => result.current.setSelectedContactId(contactB.id));
    expect(result.current.selectedContact?.id).toBe(contactB.id);
    expect(result.current.selectedContact?.email)
      .not.toBe("privileged-alpha@example.test");
    await resolveResponse(
      bDetail,
      jsonResponse({ detail: "contacts.read denied" }, 403),
    );

    expect(result.current.selectedContact?.id).toBe(contactB.id);
    expect(result.current.out).toBe("contacts.read denied");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
