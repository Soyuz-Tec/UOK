import { render } from "@testing-library/react";
import { vi } from "vitest";

import { CommunicationsWorkspace } from "../../web/src/CommunicationsWorkspace";
import type { CommunicationThread } from "../../web/src/types";

const moduleRow = {
  name: "communications.core", status: "installed", version: "3.1.0-alpha.3", kind: "capability_module",
  recorded_status: "installed", reconciliation_required: false, installable: true, uninstallable: true,
  updatable: true, maintainable: true, required: false, dependencies: [], dependents: [],
  maturity: "runtime_proven" as const,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"], lifecycle_state_declared: true,
};

export const editableCapabilities = { read: true, create: true, delete: true, restore: true };

export function workspace(token: string, status = "installed") {
  return <CommunicationsWorkspace
    token={token}
    moduleRows={[{ ...moduleRow, status }]}
    busyAction=""
    onInstall={vi.fn()}
  />;
}

export function renderWorkspace(token: string) {
  return render(workspace(token));
}

export function authHeader(options?: RequestInit) {
  return (options?.headers as Record<string, string> | undefined)?.Authorization;
}

export function thread(id: string, title: string): CommunicationThread {
  return {
    id, title, status: "open", restore_status: null, revision: 1,
    etag: `"communication-thread:${id}:v1"`, context_type: "planning.task", context_id: "task-1",
    created_by_user_id: "user-1", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
  };
}

export function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}
