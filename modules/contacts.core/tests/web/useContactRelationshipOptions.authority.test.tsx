import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactReadBoundary } from "../../web/src/app/contactReadAuthority";
import { useContactRelationshipOptions } from "../../web/src/useContactRelationshipOptions";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts relationship-options request authority", () => {
  it("never fetches or exposes selectable options without manage capability", async () => {
    vi.useFakeTimers();
    const pending = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (props) => useContactRelationshipOptions(props),
      { initialProps: lookupProps({ canManage: false }) },
    );
    act(() => vi.advanceTimersByTime(300));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ error: "", loading: false, options: [] });

    rerender(lookupProps({ canManage: true }));
    expect(result.current).toEqual({ error: "", loading: true, options: [] });
    act(() => vi.advanceTimersByTime(250));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender(lookupProps({ canManage: false }));
    expect(result.current).toEqual({ error: "", loading: false, options: [] });
    expect(signalFor(fetchMock, 0).aborted).toBe(true);
    await resolve(pending, jsonResponse([optionA]));
    expect(result.current.options).toEqual([]);
  });

  it("keeps simultaneous lookup instances in independent authority lanes", async () => {
    vi.useFakeTimers();
    const alpha = deferred<Response>();
    const beta = deferred<Response>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(alpha.promise)
      .mockReturnValueOnce(beta.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => ({
      alpha: useContactRelationshipOptions(lookupProps({ query: "alpha" })),
      beta: useContactRelationshipOptions(lookupProps({
        query: "beta",
        excludePartyId: "party-b",
      })),
    }));
    act(() => vi.advanceTimersByTime(250));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signalFor(fetchMock, 0).aborted).toBe(false);
    expect(signalFor(fetchMock, 1).aborted).toBe(false);
    await resolve(beta, jsonResponse([optionB]));
    expect(result.current.beta.options).toEqual([optionB]);
    expect(result.current.alpha.loading).toBe(true);
    await resolve(alpha, jsonResponse([optionA]));
    expect(result.current.alpha.options).toEqual([optionA]);
  });

  it("rejects query A to B to A completions that ignore abort", async () => {
    vi.useFakeTimers();
    const firstA = deferred<Response>();
    const b = deferred<Response>();
    const currentA = deferred<Response>();
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(currentA.promise);
    vi.stubGlobal("fetch", fetchMock);
    const initial = lookupProps({ onUnauthorized, query: "alpha" });
    const { result, rerender } = renderHook(
      (props) => useContactRelationshipOptions(props),
      { initialProps: initial },
    );
    act(() => vi.advanceTimersByTime(250));
    rerender(lookupProps({ onUnauthorized, query: "beta" }));
    act(() => vi.advanceTimersByTime(250));
    rerender(initial);
    act(() => vi.advanceTimersByTime(250));

    await resolve(firstA, jsonResponse({ detail: "stale session" }, 401));
    await resolve(b, jsonResponse([optionB]));
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ options: [], loading: true });
    await resolve(currentA, jsonResponse([optionA]));
    expect(result.current).toEqual({ error: "", loading: false, options: [optionA] });
  });

  it("masks prior options across session, role, lifecycle, activation, and unmount", async () => {
    vi.useFakeTimers();
    const initial = deferred<Response>();
    const replacement = deferred<Response>();
    const late = deferred<Response>();
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(replacement.promise)
      .mockReturnValueOnce(late.promise);
    vi.stubGlobal("fetch", fetchMock);
    const base = lookupProps({ onUnauthorized });
    const { result, rerender, unmount } = renderHook(
      (props) => useContactRelationshipOptions(props),
      { initialProps: base },
    );
    act(() => vi.advanceTimersByTime(250));
    await resolve(initial, jsonResponse([optionA]));
    expect(result.current.options).toEqual([optionA]);

    rerender(lookupProps({
      onUnauthorized,
      boundary: { ...base.boundary, generation: 1, role: "viewer" },
    }));
    expect(result.current.options).toEqual([]);
    act(() => vi.advanceTimersByTime(250));
    rerender(lookupProps({
      onUnauthorized,
      boundary: {
        ...base.boundary,
        generation: 1,
        role: "viewer",
        surfaceActive: false,
      },
    }));
    expect(result.current).toEqual({ error: "", loading: false, options: [] });
    expect(signalFor(fetchMock, 1).aborted).toBe(true);
    await resolve(replacement, jsonResponse([optionB]));

    rerender(lookupProps({
      onUnauthorized,
      boundary: {
        ...base.boundary,
        generation: 2,
        token: "replacement-token",
      },
    }));
    act(() => vi.advanceTimersByTime(250));
    unmount();
    expect(signalFor(fetchMock, 2).aborted).toBe(true);
    await resolve(late, jsonResponse({ detail: "late session" }, 401));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("dispatches one current unauthorized decision and masks lookup state", async () => {
    vi.useFakeTimers();
    const pending = deferred<Response>();
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { result } = renderHook(() => useContactRelationshipOptions(
      lookupProps({ onUnauthorized }),
    ));
    act(() => vi.advanceTimersByTime(250));

    await resolve(pending, jsonResponse({ detail: "session expired" }, 401));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ error: "", loading: false, options: [] });
  });
});

const optionA = {
  id: "party-a",
  display_name: "Contact Alpha",
  party_type: "person",
};
const optionB = { ...optionA, id: "party-b", display_name: "Contact Beta" };

function lookupProps(overrides: Partial<{
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  canManage: boolean;
  query: string;
  excludePartyId: string;
}> = {}) {
  return {
    boundary: readBoundary(),
    onUnauthorized: vi.fn(),
    canManage: true,
    query: "alpha",
    excludePartyId: "party-current",
    ...overrides,
  };
}

function readBoundary(): ContactReadBoundary {
  return {
    token: "lookup-token",
    generation: 0,
    role: "ops_manager",
    operational: true,
    surfaceActive: true,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function signalFor(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return (fetchMock.mock.calls[call]?.[1] as RequestInit).signal as AbortSignal;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
async function resolve(pending: Deferred<Response>, response: Response) {
  await act(async () => pending.resolve(response));
}
