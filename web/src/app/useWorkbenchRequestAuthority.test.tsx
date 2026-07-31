import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenKey, userKey } from "../shared/session";
import { useWorkbench } from "./useWorkbench";
import {
  deferred,
  hostResponse,
  jsonResponse,
  sessionUser,
  setupWorkbenchStorage,
} from "./workbenchTestSupport";

describe("useWorkbench request authority", () => {
  beforeEach(setupWorkbenchStorage);

  it("keeps the module session stable across presentation and host-data rerenders", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => hostResponse(String(input))));
    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    const initialSession = result.current.moduleHost.session;

    act(() => result.current.setAppearance("dark"));
    expect(result.current.moduleHost.session).toBe(initialSession);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.moduleHost.session).toBe(initialSession);
  });

  it("lets the latest refresh own data and loading finalization", async () => {
    const olderDashboard = deferred<Response>();
    const newerDashboard = deferred<Response>();
    let dashboardCalls = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/dashboard")) {
        dashboardCalls += 1;
        if (dashboardCalls === 2) return olderDashboard.promise;
        if (dashboardCalls === 3) return newerDashboard.promise;
      }
      return hostResponse(path, { contacts: 1 });
    }));
    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.dashboard?.counts).toEqual({ contacts: 1 }));

    let olderRefresh!: Promise<void>;
    act(() => {
      olderRefresh = result.current.refresh();
    });
    await waitFor(() => expect(dashboardCalls).toBe(2));
    let newerRefresh!: Promise<void>;
    act(() => {
      newerRefresh = result.current.refresh();
    });
    await waitFor(() => expect(dashboardCalls).toBe(3));

    olderDashboard.resolve(jsonResponse({ counts: { contacts: 200 } }));
    await act(async () => {
      await olderRefresh;
    });
    expect(result.current.busyAction).toBe("refresh");
    expect(result.current.dashboard?.counts).toEqual({ contacts: 1 });

    newerDashboard.resolve(jsonResponse({ counts: { contacts: 3 } }));
    await act(async () => {
      await newerRefresh;
    });
    expect(result.current.busyAction).toBe("");
    expect(result.current.dashboard?.counts).toEqual({ contacts: 3 });
    expect(result.current.moduleHost.moduleRefreshRevision).toBe(1);
  });

  it("serializes module actions and reconciles after each possible server commit", async () => {
    const firstAction = deferred<Response>();
    const secondAction = deferred<Response>();
    let actionCalls = 0;
    let dashboardCalls = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/modules/contacts.core/")) {
        actionCalls += 1;
        return actionCalls === 1 ? firstAction.promise : secondAction.promise;
      }
      if (path.includes("/api/dashboard")) dashboardCalls += 1;
      return hostResponse(path, { contacts: dashboardCalls });
    }));
    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    const initialDashboardCalls = dashboardCalls;

    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.moduleAction("contacts.core", "install");
    });
    let secondPromise!: Promise<void>;
    act(() => {
      secondPromise = result.current.moduleAction("contacts.core", "disable");
    });
    await waitFor(() => expect(actionCalls).toBe(1));

    firstAction.resolve(jsonResponse({ status: "installed" }));
    await act(async () => {
      await firstPromise;
    });
    expect(dashboardCalls).toBe(initialDashboardCalls + 1);
    await waitFor(() => expect(actionCalls).toBe(2));

    secondAction.resolve(jsonResponse({ status: "disabled" }));
    await act(async () => {
      await secondPromise;
    });
    expect(dashboardCalls).toBe(initialDashboardCalls + 2);
    expect(result.current.busyAction).toBe("");
  });

  it("clears the current session when its host refresh receives a 401", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      return path.includes("/api/dashboard")
        ? Promise.resolve(jsonResponse({ detail: "expired" }, 401))
        : hostResponse(path, { contacts: 1 });
    }));
    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.token).toBe(""));
    expect(result.current.currentUser).toBeNull();
    expect(result.current.dashboard).toBeNull();
    expect(result.current.out).toBe("Session expired. Sign in again.");
    expect(sessionStorage.getItem(tokenKey)).toBeNull();
  });

  it("invalidates a pending unauthorized callback on unmount", async () => {
    const pendingDashboard = deferred<Response>();
    let dashboardCalls = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/dashboard")) {
        dashboardCalls += 1;
        return pendingDashboard.promise;
      }
      return hostResponse(path);
    }));
    const { unmount } = renderHook(() => useWorkbench());
    await waitFor(() => expect(dashboardCalls).toBe(1));

    unmount();
    pendingDashboard.resolve(jsonResponse({ detail: "expired" }, 401));
    await Promise.resolve();
    await Promise.resolve();

    expect(sessionStorage.getItem(tokenKey)).toBe("test-token");
    expect(localStorage.getItem(userKey)).toBe(JSON.stringify(sessionUser));
  });
});
