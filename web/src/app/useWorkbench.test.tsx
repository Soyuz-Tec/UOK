import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryStorage } from "../shared/storage";
import { tokenKey, userKey } from "../shared/session";
import { useWorkbench } from "./useWorkbench";

const sessionUser = {
  username: "admin",
  display_name: "Admin User",
  email: "admin@example.com",
  role: "platform_admin",
};

describe("useWorkbench module host", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    window.history.replaceState({}, "", "/");
    sessionStorage.setItem(tokenKey, "test-token");
    localStorage.setItem(userKey, JSON.stringify(sessionUser));
  });

  it("clears authentication and host-scoped data when a module reports unauthorized", async () => {
    vi.stubGlobal("fetch", hostFetchMock());
    const { result } = renderHook(() => useWorkbench());

    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    expect(result.current.moduleRows).not.toEqual([]);
    expect(result.current.evidence).not.toBeNull();
    expect(result.current.alignment).not.toBeNull();

    act(() => result.current.moduleHost.onUnauthorized());

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

function hostFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/api/dashboard")
      ? { counts: { contacts: 1 } }
      : path.includes("/api/modules/catalog")
        ? {
            modules: {
              "contacts.core": {
                name: "contacts.core",
                status: "installed",
                recorded_status: "installed",
                reconciliation_required: false,
                maturity: "runtime_proven",
                version: "1.0.0",
                kind: "capability_module",
                installable: true,
                uninstallable: true,
                updatable: true,
                maintainable: true,
                required: false,
                lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
                lifecycle_state_declared: true,
                dependencies: [],
                dependents: [],
              },
            },
          }
        : { ok: true, checks: { ready: true } };
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    } as unknown as Response);
  });
}
