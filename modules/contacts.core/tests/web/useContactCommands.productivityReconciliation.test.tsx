import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommands } from "../../web/src/app/useContactCommands";
import {
  commandResponse,
  invalidJsonResponse,
} from "./ContactMutationTestUtils";
import {
  productivityContactData,
  productivityHookProps,
} from "./ContactProductivityCommandTestUtils";
import {
  contactA,
  contactB,
  contactsHost,
  deferred,
  jsonResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts productivity command reconciliation", () => {
  it.each([
    ["conflict", () => Promise.resolve(jsonResponse({ detail: "conflict" }, 409))],
    ["malformed success", () => Promise.resolve(invalidJsonResponse())],
    ["commit-then-503", () => Promise.resolve(jsonResponse({ detail: "late failure" }, 503))],
    ["transport loss", () => Promise.reject(new TypeError("connection lost"))],
  ])("reconciles a %s once without replay or retained raw error data", async (
    _label,
    response,
  ) => {
    const fetchMock = vi.fn(response);
    vi.stubGlobal("fetch", fetchMock);
    const props = productivityHookProps();
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => {
      await expect(result.current.addNote()).resolves.toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(props.data.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
    expect(props.setNoteText).not.toHaveBeenCalled();
    const retained = vi.mocked(props.data.setOut).mock.calls.at(-1)?.[0];
    expect(retained).toBeInstanceOf(Error);
    expect(retained).not.toHaveProperty("body");
    expect(retained).not.toHaveProperty("status");
  });

  it("suppresses effects after selection A-B-A during reconciliation", async () => {
    const command = deferred<Response>();
    const reconciliation = deferred<{
      kind: "applied";
      preferenceCurrent: boolean;
      selectedId: string;
    }>();
    let reconciliationRequest: { preferenceIsCurrent?: () => boolean } = {};
    const reconcilePrimaryContacts = vi.fn((request = {}) => {
      reconciliationRequest = request;
      return reconciliation.promise;
    });
    const firstHost = contactsHost({ refreshHost: vi.fn().mockResolvedValue(undefined) });
    const initial = productivityHookProps({
      data: productivityContactData(contactA, reconcilePrimaryContacts),
      host: firstHost,
    });
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    let operation!: Promise<boolean>;
    act(() => { operation = view.result.current.addNote(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.mocked(initial.data.setOut).mockClear();

    act(() => command.resolve(commandResponse(contactA)));
    await waitFor(() => expect(reconcilePrimaryContacts).toHaveBeenCalledTimes(1));
    view.rerender({ props: productivityHookProps({
      data: productivityContactData(contactB, reconcilePrimaryContacts, 2),
      host: contactsHost(),
    }) });
    view.rerender({ props: productivityHookProps({
      data: productivityContactData(contactA, reconcilePrimaryContacts, 3),
      host: contactsHost(),
    }) });

    expect(reconciliationRequest.preferenceIsCurrent?.()).toBe(false);
    expect(view.result.current.busyAction).toBe("reconcile");
    await act(async () => {
      reconciliation.resolve({
        kind: "applied",
        preferenceCurrent: false,
        selectedId: contactA.id,
      });
      await operation;
    });

    expect(initial.setNoteText).not.toHaveBeenCalled();
    expect(initial.data.setOut).not.toHaveBeenCalled();
    expect(firstHost.refreshHost).not.toHaveBeenCalled();
    expect(view.result.current.productivityRefreshGeneration).toBe(0);
    expect(view.result.current.busyAction).toBe("");
  });

  it.each(["failed", "deferred"])(
    "keeps %s reconciliation locked without redispatch",
    async (kind) => {
      const reconcilePrimaryContacts = vi.fn()
        .mockResolvedValueOnce(kind === "failed"
          ? { kind: "failed", error: new Error("reads unavailable") }
          : { kind: "deferred" })
        .mockResolvedValueOnce({
          kind: "applied",
          preferenceCurrent: true,
          selectedId: contactA.id,
        });
      const props = productivityHookProps({
        data: productivityContactData(contactA, reconcilePrimaryContacts),
      });
      const fetchMock = vi.fn().mockResolvedValue(commandResponse(contactA));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useContactCommands(props));

      await act(async () => {
        await expect(result.current.addNote()).resolves.toBe(false);
        await expect(result.current.linkRelationship()).resolves.toBe(false);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.reconciliationPending).toBe(true);

      await act(async () => {
        await expect(result.current.retryPendingReconciliation()).resolves.toBe(true);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(reconcilePrimaryContacts).toHaveBeenCalledTimes(2);
    },
  );
});
