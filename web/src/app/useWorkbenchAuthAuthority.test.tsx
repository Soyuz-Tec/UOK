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

describe("useWorkbench authentication authority", () => {
  beforeEach(setupWorkbenchStorage);

  it("keeps the newest authentication attempt authoritative when the token repeats", async () => {
    sessionStorage.clear();
    localStorage.clear();
    const firstLogin = deferred<Response>();
    const secondLogin = deferred<Response>();
    let loginCalls = 0;
    let dashboardCalls = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/auth/login")) {
        loginCalls += 1;
        return loginCalls === 1 ? firstLogin.promise : secondLogin.promise;
      }
      if (path.includes("/api/dashboard")) dashboardCalls += 1;
      return hostResponse(path, { contacts: 2 });
    }));
    const { result } = renderHook(() => useWorkbench());

    act(() => result.current.setPassword("first-password"));
    let firstAttempt!: Promise<void>;
    act(() => {
      firstAttempt = result.current.login();
    });
    await waitFor(() => expect(loginCalls).toBe(1));

    act(() => result.current.setPassword("second-password"));
    let secondAttempt!: Promise<void>;
    act(() => {
      secondAttempt = result.current.login();
    });
    await waitFor(() => expect(loginCalls).toBe(2));

    const secondUser = { ...sessionUser, username: "second", display_name: "Second User" };
    secondLogin.resolve(jsonResponse({ access_token: "same-token", user: secondUser }));
    await act(async () => {
      await secondAttempt;
    });
    await waitFor(() => expect(result.current.dashboard?.counts).toEqual({ contacts: 2 }));
    const authoritativeGeneration = result.current.moduleHost.session.generation;
    expect(authoritativeGeneration).toBeGreaterThan(0);

    firstLogin.resolve(jsonResponse({
      access_token: "same-token",
      user: { ...sessionUser, username: "first", display_name: "First User" },
    }));
    await act(async () => {
      await firstAttempt;
    });

    expect(result.current.token).toBe("same-token");
    expect(result.current.currentUser).toEqual(secondUser);
    expect(result.current.moduleHost.session.generation).toBe(authoritativeGeneration);
    expect(dashboardCalls).toBe(1);
    expect(sessionStorage.getItem(tokenKey)).toBe("same-token");
    expect(localStorage.getItem(userKey)).toBe(JSON.stringify(secondUser));
  });

  it("ignores an old same-token session 401 after logout and replacement", async () => {
    sessionStorage.setItem(tokenKey, "same-token");
    const oldDashboard = deferred<Response>();
    let dashboardCalls = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/auth/login")) {
        const nextUser = { ...sessionUser, username: "replacement", display_name: "Replacement" };
        return Promise.resolve(jsonResponse({ access_token: "same-token", user: nextUser }));
      }
      if (path.includes("/api/dashboard")) {
        dashboardCalls += 1;
        return dashboardCalls === 1
          ? oldDashboard.promise
          : hostResponse(path, { contacts: 2 });
      }
      return hostResponse(path, { contacts: 2 });
    }));
    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(dashboardCalls).toBe(1));

    act(() => result.current.clearSession());
    act(() => result.current.setPassword("replacement-password"));
    let replacement!: Promise<void>;
    act(() => {
      replacement = result.current.login();
    });
    await act(async () => {
      await replacement;
    });
    await waitFor(() => expect(result.current.dashboard?.counts).toEqual({ contacts: 2 }));

    oldDashboard.resolve(jsonResponse({ detail: "expired" }, 401));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.token).toBe("same-token");
    expect(result.current.currentUser?.username).toBe("replacement");
    expect(result.current.dashboard?.counts).toEqual({ contacts: 2 });
  });
});
