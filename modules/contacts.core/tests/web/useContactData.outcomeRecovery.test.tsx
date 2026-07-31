import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useContactData } from "../../web/src/app/useContactData";
import {
  contactA, contactFilters, contactsHost, createContactReadRouter,
  groupA, groupB, jsonResponse, resolveResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts read outcome recovery and command precedence", () => {
  it("clears a groups error after a same-boundary groups success", async () => {
    const router = createContactReadRouter();
    const initialList = router.defer("list");
    const failedGroups = router.defer("groups");
    const detail = router.defer(`detail:${contactA.id}`);
    const pendingList = router.defer("list");
    const recoveredGroups = router.defer("groups");
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(), true, contactFilters(),
    ));
    await resolveResponse(initialList, jsonResponse([contactA], 200, 1));
    await resolveResponse(
      failedGroups,
      jsonResponse({ detail: "groups unavailable" }, 503),
    );
    await resolveResponse(detail, jsonResponse(contactA));
    expect(result.current.out).toBe("groups unavailable");
    act(() => {
      void result.current.refresh();
    });

    await resolveResponse(recoveredGroups, jsonResponse([groupB]));
    expect(result.current.contactGroups).toEqual([groupB]);
    expect(result.current.out).toBeNull();
    await resolveResponse(pendingList, jsonResponse([contactA], 200, 1));
  });

  it.each([403, 503])(
    "clears a detail HTTP %s outcome after same-criteria success",
    async (status) => {
      const router = createContactReadRouter();
      const list = router.defer("list");
      const groups = router.defer("groups");
      const failedDetail = router.defer(`detail:${contactA.id}`);
      const recoveredDetail = router.defer(`detail:${contactA.id}`);
      vi.stubGlobal("fetch", router.fetchMock);
      const { result } = renderHook(() => useContactData(
        contactsHost(), true, contactFilters(),
      ));
      await resolveResponse(list, jsonResponse([contactA], 200, 1));
      await resolveResponse(groups, jsonResponse([groupA]));
      await resolveResponse(
        failedDetail,
        jsonResponse({ detail: "detail unavailable" }, status),
      );
      expect(result.current.out).toBe("detail unavailable");
      act(() => {
        void result.current.loadContactDetail(contactA.id);
      });

      await resolveResponse(recoveredDetail, jsonResponse({
        ...contactA,
        email: "recovered-alpha@example.test",
      }));
      expect(result.current.selectedContact?.email)
        .toBe("recovered-alpha@example.test");
      expect(result.current.out).toBeNull();
    },
  );

  it("keeps command busy and outcome state ahead of read settlement", async () => {
    const router = createContactReadRouter();
    const list = router.defer("list");
    const groups = router.defer("groups");
    const detail = router.defer(`detail:${contactA.id}`);
    vi.stubGlobal("fetch", router.fetchMock);
    const { result } = renderHook(() => useContactData(
      contactsHost(), true, contactFilters(),
    ));
    const commandOutcome = {
      result: { id: contactA.id },
      status: "command-complete",
    };
    act(() => {
      result.current.setBusyAction("UpdateContact");
      result.current.setOut(commandOutcome);
    });

    await resolveResponse(list, jsonResponse([contactA], 200, 1));
    await resolveResponse(
      groups,
      jsonResponse({ detail: "groups unavailable" }, 503),
    );
    await resolveResponse(detail, jsonResponse(contactA));
    expect(result.current.busyAction).toBe("UpdateContact");
    expect(result.current.out).toEqual(commandOutcome);

    act(() => {
      result.current.setBusyAction("");
      result.current.setOut(null);
    });
    expect(result.current.busyAction).toBe("");
    expect(result.current.out).toBe("groups unavailable");
  });
});
