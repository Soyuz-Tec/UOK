import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommandCoordinator } from "../../web/src/app/useContactCommandCoordinator";
import {
  commandError,
  coordinatorProps,
  deferredReconciliation,
  interactionA,
  operationInput,
  succeededResponse,
} from "./ContactCommandCoordinatorTestUtils";
import { contactsHost, deferred } from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts command reconciliation", () => {
  it("publishes success only after authoritative reconciliation", async () => {
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    const reconcile = deferredReconciliation();
    const options = coordinatorProps({
      host: contactsHost({ refreshHost }),
      reconcilePrimaryContacts: vi.fn(() => reconcile.promise),
    });
    const input = operationInput();
    const { result } = renderHook(() => useContactCommandCoordinator(options));
    let operation!: Promise<boolean>;
    act(() => { operation = result.current.runOperation(input); });
    await waitFor(() => expect(options.reconcilePrimaryContacts).toHaveBeenCalled());

    expect(input.onSuccess).not.toHaveBeenCalled();
    await act(async () => {
      reconcile.resolve({
        kind: "applied",
        preferenceCurrent: true,
        selectedId: "contact-a",
      });
      await operation;
    });

    expect(input.preferredSelectedId).toHaveBeenCalledWith(succeededResponse);
    expect(input.onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refreshHost).toHaveBeenCalledTimes(1));
    expect(result.current.operationActive).toBe(false);
  });

  it.each([
    ["commit-then-503", commandError(503, true)],
    ["network loss", commandError(0, true)],
    ["malformed success", commandError(200, true)],
    ["conflict", commandError(409)],
  ])("reconciles %s without replay", async (_label, error) => {
    const options = coordinatorProps();
    const input = operationInput({
      execute: vi.fn().mockRejectedValue(error),
    });
    const { result } = renderHook(() => useContactCommandCoordinator(options));

    await act(async () => result.current.runOperation(input));

    expect(input.execute).toHaveBeenCalledTimes(1);
    expect(options.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
    expect(input.onError).toHaveBeenCalledWith(error);
    expect(input.onSuccess).not.toHaveBeenCalled();
  });

  it("keeps a failed reconciliation locked until explicit retry", async () => {
    const reconcilePrimaryContacts = vi.fn()
      .mockResolvedValueOnce({ kind: "failed", error: new Error("reads down") })
      .mockResolvedValueOnce({
        kind: "applied",
        preferenceCurrent: true,
        selectedId: "contact-a",
      });
    const options = coordinatorProps({ reconcilePrimaryContacts });
    const input = operationInput();
    const second = operationInput({ action: "ArchiveContact" });
    const { result } = renderHook(() => useContactCommandCoordinator(options));

    await act(async () => result.current.runOperation(input));
    expect(result.current.reconciliationPending).toBe(true);
    expect(result.current.operationActive).toBe(true);
    expect(input.onPending).toHaveBeenCalledTimes(1);
    await act(async () => {
      await expect(result.current.runOperation(second)).resolves.toBe(false);
    });
    expect(second.execute).not.toHaveBeenCalled();

    await act(async () => result.current.retryPendingReconciliation());
    expect(reconcilePrimaryContacts).toHaveBeenCalledTimes(2);
    expect(input.execute).toHaveBeenCalledTimes(1);
    expect(input.onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.operationActive).toBe(false);
  });

  it.each(["success", "error"])(
    "suppresses stale %s effects and keeps the lock through reconciliation",
    async (settlement) => {
      const command = deferred<typeof succeededResponse>();
      const reconciliation = deferredReconciliation();
      const refreshHost = vi.fn().mockResolvedValue(undefined);
      const initial = coordinatorProps({
        host: contactsHost({ refreshHost }),
        reconcilePrimaryContacts: vi.fn(() => reconciliation.promise),
      });
      const input = operationInput({ execute: vi.fn(() => command.promise) });
      const view = renderHook(
        ({ options }) => useContactCommandCoordinator(options),
        { initialProps: { options: initial } },
      );
      let operation!: Promise<boolean>;
      act(() => { operation = view.result.current.runOperation(input); });
      await waitFor(() => expect(input.execute).toHaveBeenCalledTimes(1));
      view.rerender({ options: {
        ...initial,
        interaction: { ...interactionA, criteriaGeneration: 2 },
      } });
      act(() => settlement === "success"
        ? command.resolve(succeededResponse)
        : command.reject(commandError(503, true)));
      await waitFor(() => expect(initial.reconcilePrimaryContacts).toHaveBeenCalled());

      expect(view.result.current.busyAction).toBe("reconcile");
      const repeated = operationInput({ action: "RestoreContact" });
      await act(async () => {
        await expect(view.result.current.runOperation(repeated)).resolves.toBe(false);
      });
      reconciliation.resolve({
        kind: "applied",
        preferenceCurrent: false,
        selectedId: "contact-a",
      });
      await act(async () => operation);

      expect(repeated.execute).not.toHaveBeenCalled();
      expect(input.onSuccess).not.toHaveBeenCalled();
      expect(input.onError).not.toHaveBeenCalled();
      expect(input.onPending).not.toHaveBeenCalled();
      expect(refreshHost).not.toHaveBeenCalled();
      expect(view.result.current.operationActive).toBe(false);
    },
  );

  it("retries a deferred hidden completion after reactivation", async () => {
    let active = true;
    const command = deferred<typeof succeededResponse>();
    const reconcilePrimaryContacts = vi.fn(async () => active ? {
      kind: "applied" as const,
      preferenceCurrent: false,
      selectedId: "contact-a",
    } : { kind: "deferred" as const });
    const initial = coordinatorProps({ reconcilePrimaryContacts });
    const input = operationInput({ execute: vi.fn(() => command.promise) });
    const view = renderHook(
      ({ options }) => useContactCommandCoordinator(options),
      { initialProps: { options: initial } },
    );
    let operation!: Promise<boolean>;
    act(() => { operation = view.result.current.runOperation(input); });
    await waitFor(() => expect(input.execute).toHaveBeenCalledTimes(1));
    active = false;
    view.rerender({ options: {
      ...initial,
      host: contactsHost({ surfaceActive: false }),
    } });
    await act(async () => command.resolve(succeededResponse));
    await waitFor(() => expect(view.result.current.reconciliationPending).toBe(true));

    active = true;
    view.rerender({ options: initial });
    await act(async () => operation);
    expect(reconcilePrimaryContacts).toHaveBeenCalledTimes(2);
    expect(input.execute).toHaveBeenCalledTimes(1);
    expect(input.onSuccess).not.toHaveBeenCalled();
  });

  it("treats host refresh failure as non-fatal", async () => {
    const refreshHost = vi.fn().mockRejectedValue(new Error("host down"));
    const options = coordinatorProps({ host: contactsHost({ refreshHost }) });
    const input = operationInput();
    const { result } = renderHook(() => useContactCommandCoordinator(options));

    await act(async () => result.current.runOperation(input));
    await waitFor(() => expect(refreshHost).toHaveBeenCalledTimes(1));
    expect(input.onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.operationActive).toBe(false);
  });
});
