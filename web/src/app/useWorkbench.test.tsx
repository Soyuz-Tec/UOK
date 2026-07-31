import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenKey, userKey } from "../shared/session";
import { useWorkbench } from "./useWorkbench";
import { hostFetchMock, setupWorkbenchStorage } from "./workbenchTestSupport";

describe("useWorkbench module host", () => {
  beforeEach(() => {
    setupWorkbenchStorage();
  });

  it("clears authentication and host-scoped data when a module reports unauthorized", async () => {
    vi.stubGlobal("fetch", hostFetchMock());
    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    expect(result.current.moduleRows).not.toEqual([]);
    expect(result.current.evidence).not.toBeNull();
    expect(result.current.alignment).not.toBeNull();

    act(() => result.current.moduleHost.session.onUnauthorized());

    expect(result.current.token).toBe("");
    expect(result.current.currentUser).toBeNull();
    expect(result.current.dashboard).toBeNull();
    expect(result.current.moduleRows).toEqual([]);
    expect(result.current.evidence).toBeNull();
    expect(result.current.alignment).toBeNull();
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
    expect(localStorage.getItem(tokenKey)).toBeNull();
    expect(localStorage.getItem(userKey)).toBeNull();
  });

  it("publishes a neutral module refresh revision after a global refresh", async () => {
    const fetchMock = hostFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    const dashboardCalls = () => fetchMock.mock.calls
      .filter(([input]) => String(input).includes("/api/dashboard"))
      .length;
    const before = dashboardCalls();

    await act(async () => {
      await result.current.refresh();
    });

    expect(dashboardCalls()).toBeGreaterThan(before);
    expect(result.current.moduleHost.moduleRefreshRevision).toBe(1);
  });

});
