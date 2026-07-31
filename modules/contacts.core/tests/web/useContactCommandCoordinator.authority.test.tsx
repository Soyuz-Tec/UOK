import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommandCoordinator } from "../../web/src/app/useContactCommandCoordinator";
import {
  commandError,
  coordinatorProps,
  interactionA,
  operationInput,
  type succeededResponse,
} from "./ContactCommandCoordinatorTestUtils";
import { contactsHost, deferred } from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts command coordinator authority", () => {
  it("uses a synchronous single-flight lock for same-tick submission", async () => {
    const options = coordinatorProps();
    const input = operationInput();
    const { result } = renderHook(() => useContactCommandCoordinator(options));
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;

    await act(async () => {
      first = result.current.runOperation(input);
      second = result.current.runOperation(input);
      await Promise.all([first, second]);
    });

    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(input.execute).toHaveBeenCalledTimes(1);
    expect(options.supersedeReadsForMutation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["session", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      host: contactsHost({ session: { generation: 1 } }),
    })],
    ["role", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      host: contactsHost({ currentUserRole: "viewer" }),
    })],
    ["operational state", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      operational: false,
    })],
    ["surface state", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      host: contactsHost({ surfaceActive: false }),
    })],
    ["filter generation", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      interaction: { ...interactionA, criteriaGeneration: 2 },
    })],
    ["selection", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      interaction: {
        ...interactionA,
        selectedId: "contact-b",
        selectionGeneration: 2,
      },
    })],
    ["selected revision", (options: ReturnType<typeof coordinatorProps>) => ({
      ...options,
      interaction: {
        ...interactionA,
        selectedRevision: "2026-07-31T12:00:00Z",
      },
    })],
  ])("fails %s changes closed before dispatch", async (_label, replace) => {
    const initial = coordinatorProps();
    const input = operationInput();
    const view = renderHook(
      ({ options }) => useContactCommandCoordinator(options),
      { initialProps: { options: initial } },
    );
    let operation!: Promise<boolean>;
    act(() => {
      operation = view.result.current.runOperation(input);
      view.rerender({ options: replace(initial) });
    });

    await act(async () => operation);
    expect(input.execute).not.toHaveBeenCalled();
  });

  it("fails changed draft intent and unmount closed before dispatch", async () => {
    let draftCurrent = true;
    const draftInput = operationInput({
      intentIsCurrent: vi.fn(() => draftCurrent),
    });
    const view = renderHook(() => useContactCommandCoordinator(coordinatorProps()));
    let draftOperation!: Promise<boolean>;
    act(() => {
      draftOperation = view.result.current.runOperation(draftInput);
      draftCurrent = false;
    });
    await act(async () => draftOperation);
    expect(draftInput.execute).not.toHaveBeenCalled();

    const unmountInput = operationInput();
    let unmountOperation!: Promise<boolean>;
    act(() => {
      unmountOperation = view.result.current.runOperation(unmountInput);
      view.unmount();
    });
    await act(async () => unmountOperation);
    expect(unmountInput.execute).not.toHaveBeenCalled();
  });

  it("handles a current command 401 once without reconciliation", async () => {
    const onUnauthorized = vi.fn();
    const options = coordinatorProps({
      host: contactsHost({ session: { onUnauthorized } }),
    });
    const input = operationInput({
      execute: vi.fn(async (request) => {
        request.onUnauthorized();
        request.onUnauthorized();
        throw commandError(401);
      }),
    });
    const { result } = renderHook(() => useContactCommandCoordinator(options));

    await act(async () => result.current.runOperation(input));
    await act(async () => {
      await expect(result.current.retryPendingReconciliation()).resolves.toBe(false);
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(input.execute).toHaveBeenCalledTimes(1);
    expect(options.reconcilePrimaryContacts).not.toHaveBeenCalled();
    expect(input.onError).not.toHaveBeenCalled();
    expect(result.current.operationActive).toBe(false);
  });

  it("keeps a stale command 401 inert", async () => {
    const command = deferred<typeof succeededResponse>();
    let request!: { onUnauthorized: () => void };
    const firstUnauthorized = vi.fn();
    const currentUnauthorized = vi.fn();
    const initial = coordinatorProps({
      host: contactsHost({ session: { onUnauthorized: firstUnauthorized } }),
    });
    const input = operationInput({
      execute: vi.fn((next) => {
        request = next;
        return command.promise;
      }),
    });
    const view = renderHook(
      ({ options }) => useContactCommandCoordinator(options),
      { initialProps: { options: initial } },
    );
    let operation!: Promise<boolean>;
    act(() => { operation = view.result.current.runOperation(input); });
    await waitFor(() => expect(input.execute).toHaveBeenCalledTimes(1));
    view.rerender({ options: coordinatorProps({
      ...initial,
      host: contactsHost({
        session: { generation: 1, onUnauthorized: currentUnauthorized },
      }),
    }) });

    await act(async () => {
      request.onUnauthorized();
      command.reject(commandError(401));
      await operation;
    });
    expect(firstUnauthorized).not.toHaveBeenCalled();
    expect(currentUnauthorized).not.toHaveBeenCalled();
    expect(initial.reconcilePrimaryContacts).not.toHaveBeenCalled();
  });
});
