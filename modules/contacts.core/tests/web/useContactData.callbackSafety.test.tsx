import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useContactData } from "../../web/src/app/useContactData";
import {
  contactA, contactB, contactFilters, contactsHost, createContactReadRouter,
  groupA, groupB, jsonResponse, resolveResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts captured-callback and stale-finalizer authority", () => {
  it("rejects a captured refresh after generation and filter replacement", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const initialGroups = router.defer("groups");
    const initialDetail = router.defer(`detail:${contactA.id}`);
    const replacementList = router.defer("list");
    const replacementGroups = router.defer("groups");
    const replacementDetail = router.defer(`detail:${contactB.id}`);
    router.defer("list");
    router.defer("groups");
    vi.stubGlobal("fetch", router.fetchMock);
    const initialHost = contactsHost({
      session: { token: "stable-token", generation: 0 },
    });
    const { result, rerender } = renderHook(
      ({ host, filters }) => useContactData(host, true, filters),
      {
        initialProps: {
          host: initialHost,
          filters: contactFilters({ query: "alpha" }),
        },
      },
    );
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    await resolveResponse(initialGroups, jsonResponse([groupA]));
    await resolveResponse(initialDetail, jsonResponse(contactA));
    const capturedRefresh = result.current.refresh;

    rerender({
      host: {
        ...initialHost,
        session: { ...initialHost.session, generation: 1 },
      },
      filters: contactFilters({ query: "beta" }),
    });
    await resolveResponse(replacementList, jsonResponse([contactB], 200, 1));
    await resolveResponse(replacementGroups, jsonResponse([groupB]));
    await resolveResponse(replacementDetail, jsonResponse(contactB));
    expect(result.current.contacts).toEqual([contactB]);
    expect(router.callsFor("list")[1]?.path).toContain("query=beta");

    act(() => {
      void capturedRefresh();
    });

    expect(router.callsFor("list")).toHaveLength(2);
    expect(router.callsFor("groups")).toHaveLength(2);
    expect(result.current.contacts).toEqual([contactB]);
  });

  it("cannot let a captured A loader abort or strand current B detail", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const initialGroups = router.defer("groups");
    const initialDetail = router.defer(`detail:${contactA.id}`);
    const replacementList = router.defer("list");
    const replacementGroups = router.defer("groups");
    const replacementDetail = router.defer(`detail:${contactB.id}`);
    router.defer(`detail:${contactA.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const initialHost = contactsHost({
      session: { token: "stable-token", generation: 0 },
    });
    const { result, rerender } = renderHook(
      ({ host, filters }) => useContactData(host, true, filters),
      {
        initialProps: {
          host: initialHost,
          filters: contactFilters({ query: "alpha" }),
        },
      },
    );
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    await resolveResponse(initialGroups, jsonResponse([groupA]));
    await resolveResponse(initialDetail, jsonResponse(contactA));
    const capturedLoadA = result.current.loadContactDetail;

    rerender({
      host: {
        ...initialHost,
        session: { ...initialHost.session, generation: 1 },
      },
      filters: contactFilters({ query: "beta" }),
    });
    await resolveResponse(replacementList, jsonResponse([contactB], 200, 1));
    await resolveResponse(replacementGroups, jsonResponse([groupB]));
    const bSignal = router.callsFor(`detail:${contactB.id}`)[0]?.signal;
    expect(bSignal?.aborted).toBe(false);

    act(() => {
      void capturedLoadA(contactA.id);
    });

    expect(router.callsFor(`detail:${contactA.id}`)).toHaveLength(1);
    expect(bSignal?.aborted).toBe(false);
    await resolveResponse(replacementDetail, jsonResponse({
      ...contactB,
      email: "current-beta@example.test",
    }));
    expect(result.current.selectedContact?.email)
      .toBe("current-beta@example.test");
  });

  it("keeps current outcome and busy state over stale non-401 finalizers", async () => {
    const router = createContactReadRouter();
    const staleList = router.defer("list");
    const staleGroups = router.defer("groups");
    const currentList = router.defer("list");
    const currentGroups = router.defer("groups");
    const detail = router.defer(`detail:${contactB.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(), true, contactFilters(),
    ));
    act(() => {
      void result.current.refresh();
    });
    await resolveResponse(currentList, jsonResponse([contactB], 200, 1));
    expect(result.current.out).toEqual({ status: "ready", count: 1 });
    expect(result.current.busyAction).toBe("refresh");

    await resolveResponse(staleList, jsonResponse({ detail: "stale list" }, 503));
    await resolveResponse(staleGroups, jsonResponse({ detail: "stale groups" }, 503));
    expect(result.current.out).toEqual({ status: "ready", count: 1 });
    expect(result.current.busyAction).toBe("refresh");

    await resolveResponse(currentGroups, jsonResponse([groupB]));
    await resolveResponse(detail, jsonResponse(contactB));
    expect(result.current.busyAction).toBe("");
  });
});
