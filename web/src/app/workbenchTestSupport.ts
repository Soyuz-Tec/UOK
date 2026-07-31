import { vi } from "vitest";

import { tokenKey, userKey } from "../shared/session";
import { createMemoryStorage } from "../shared/storage";

export const sessionUser = {
  username: "admin",
  display_name: "Admin User",
  email: "admin@example.com",
  role: "platform_admin",
};

export function setupWorkbenchStorage() {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", createMemoryStorage());
  vi.stubGlobal("sessionStorage", createMemoryStorage());
  window.history.replaceState({}, "", "/");
  sessionStorage.setItem(tokenKey, "test-token");
  localStorage.setItem(userKey, JSON.stringify(sessionUser));
}

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

export function hostResponse(path: string, counts = { contacts: 1 }) {
  const body = path.includes("/api/dashboard")
    ? { counts }
    : path.includes("/api/modules/catalog")
      ? { modules: { "contacts.core": contactModuleStatus } }
      : { ok: true, checks: { ready: true } };
  return Promise.resolve(jsonResponse(body));
}

export function hostFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/api/dashboard")
      ? { counts: { contacts: 1 } }
      : path.includes("/api/modules/catalog")
        ? { modules: { "contacts.core": contactModuleStatus } }
        : { ok: true, checks: { ready: true } };
    return Promise.resolve(jsonResponse(body));
  });
}

const contactModuleStatus = {
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
};
