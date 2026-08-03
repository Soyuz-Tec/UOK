import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactReadBoundary } from "../../web/src/app/contactReadAuthority";
import { useContactActivity } from "../../web/src/useContactActivity";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts activity request authority", () => {
  it("commits only the current Party revision, paging, and refresh criteria", async () => {
    const firstA = deferred<Response>();
    const b = deferred<Response>();
    const currentA = deferred<Response>();
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(currentA.promise);
    vi.stubGlobal("fetch", fetchMock);
    const initial = activityProps({ onUnauthorized });
    const { result, rerender } = renderHook(
      (props) => useContactActivity(props),
      { initialProps: initial },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(activityProps({
      onUnauthorized,
      partyId: "party-b",
      contactRevision: "revision-b",
      page: 1,
      pageSize: 25,
      refreshGeneration: 1,
    }));
    rerender(initial);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.items).toEqual([]);

    await resolve(firstA, jsonResponse({ detail: "stale session" }, 401));
    await resolve(b, jsonResponse([activityB], 200, 1));
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    await resolve(currentA, jsonResponse([activityA], 200, 7));

    expect(result.current).toMatchObject({
      error: "",
      items: [activityA],
      loading: false,
      totalCount: 7,
    });
  });

  it("masks committed state synchronously across every read boundary", async () => {
    const initial = deferred<Response>();
    const replacement = deferred<Response>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(replacement.promise);
    vi.stubGlobal("fetch", fetchMock);
    const base = activityProps();
    const { result, rerender } = renderHook(
      (props) => useContactActivity(props),
      { initialProps: base },
    );
    await resolve(initial, jsonResponse([activityA], 200, 1));
    expect(result.current.items).toEqual([activityA]);

    rerender(activityProps({
      boundary: { ...base.boundary, generation: 1, role: "viewer" },
    }));
    expect(result.current).toMatchObject({
      error: "",
      items: [],
      loading: true,
      totalCount: 0,
    });
    rerender(activityProps({
      boundary: {
        ...base.boundary,
        generation: 1,
        role: "viewer",
        operational: false,
      },
    }));
    expect(result.current).toMatchObject({ items: [], loading: false });
    expect(signalFor(fetchMock, 1).aborted).toBe(true);
    await resolve(replacement, jsonResponse([activityB], 200, 1));
    expect(result.current.items).toEqual([]);
  });

  it("suppresses abort-ignoring errors and finalizers from superseded work", async () => {
    const stale = deferred<Response>();
    const current = deferred<Response>();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (props) => useContactActivity(props),
      { initialProps: activityProps() },
    );
    rerender(activityProps({ refreshGeneration: 2 }));
    expect(result.current.loading).toBe(true);

    await resolve(stale, jsonResponse({ detail: "stale failure" }, 503));
    expect(result.current).toMatchObject({ error: "", loading: true });
    await resolve(current, jsonResponse([activityB], 200, 1));
    expect(result.current).toMatchObject({
      error: "",
      items: [activityB],
      loading: false,
    });
  });

  it("disposes pending activity and suppresses a late unauthorized decision", async () => {
    const pending = deferred<Response>();
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => useContactActivity(
      activityProps({ onUnauthorized }),
    ));
    unmount();

    expect(signalFor(fetchMock, 0).aborted).toBe(true);
    await resolve(pending, jsonResponse({ detail: "late session" }, 401));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("dispatches one current unauthorized decision and masks request state", async () => {
    const pending = deferred<Response>();
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { result } = renderHook(() => useContactActivity(
      activityProps({ onUnauthorized }),
    ));

    await resolve(pending, jsonResponse({ detail: "session expired" }, 401));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({
      error: "",
      items: [],
      loading: false,
      totalCount: 0,
    });
  });
});

const activityA = {
  id: "activity-a",
  party_id: "party-a",
  activity_type: "updated",
  object_type: "party",
  object_id: "party-a",
  summary: "Updated Alpha",
  occurred_at: "2026-07-31T08:00:00Z",
};
const activityB = { ...activityA, id: "activity-b", summary: "Updated Beta" };

function activityProps(overrides: Partial<{
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  partyId: string;
  contactRevision: string;
  page: number;
  pageSize: number;
  refreshGeneration: number;
}> = {}) {
  return {
    boundary: readBoundary(),
    onUnauthorized: vi.fn(),
    partyId: "party-a",
    contactRevision: "revision-a",
    page: 0,
    pageSize: 10,
    refreshGeneration: 0,
    ...overrides,
  };
}

function readBoundary(): ContactReadBoundary {
  return {
    token: "activity-token",
    generation: 0,
    role: "ops_manager",
    operational: true,
    surfaceActive: true,
  };
}

function jsonResponse(value: unknown, status = 200, totalCount?: number) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (totalCount !== undefined) headers.set("X-Total-Count", String(totalCount));
  return new Response(JSON.stringify(value), { headers, status });
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
