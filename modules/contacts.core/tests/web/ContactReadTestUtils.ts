import { act } from "@testing-library/react";
import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type {
  ContactFilters,
  ContactGroupRecord,
  ContactRecord,
} from "../../web/src/contracts";
export const contactA: ContactRecord = {
  id: "contact-a",
  party_type: "person",
  display_name: "Contact Alpha",
  status: "active",
  review_state: "ready",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "alpha-v1@example.test",
  updated_at: "2026-07-30T10:00:00Z",
};
export const contactARevision: ContactRecord = {
  ...contactA,
  display_name: "Contact Alpha Current",
  email: "alpha-v2@example.test",
  updated_at: "2026-07-30T11:00:00Z",
};
export const contactB: ContactRecord = {
  ...contactA,
  id: "contact-b",
  display_name: "Contact Beta",
  email: "beta@example.test",
  updated_at: "2026-07-30T12:00:00Z",
};
export const tenantBContact: ContactRecord = {
  ...contactA,
  id: "tenant-b-contact",
  display_name: "Tenant B Contact",
  email: "tenant-b@example.test",
};
export const groupA: ContactGroupRecord = {
  id: "group-a",
  name: "Group Alpha",
  description: "",
  kind: "manual",
  visibility_scope: "organization",
  status: "active",
  member_count: 1,
  active_member_count: 1,
};
export const groupB: ContactGroupRecord = {
  ...groupA,
  id: "group-b",
  name: "Group Beta",
};
export function contactFilters(
  overrides: Partial<ContactFilters> = {},
): ContactFilters {
  return {
    query: "",
    contactGroupId: "",
    statusFilter: "active",
    reviewFilter: "all",
    typeFilter: "all",
    sourceFilter: "all",
    qualityFilter: "all",
    contactPage: 0,
    contactPageSize: 25,
    contactSortBy: "updated_at",
    contactSortDir: "desc",
    ...overrides,
  };
}
type HostOverrides = Omit<Partial<ModuleSurfaceRenderContext>, "session"> & {
  session?: Partial<ModuleSurfaceRenderContext["session"]>;
};
export function contactsHost(
  overrides: HostOverrides = {},
): ModuleSurfaceRenderContext {
  const { session, ...hostOverrides } = overrides;
  return {
    session: {
      token: "test-token",
      generation: 0,
      onUnauthorized: vi.fn(),
      ...session,
    },
    currentUserRole: "ops_manager",
    appearance: "system",
    moduleRows: [contactsModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    surfaceActive: true,
    ...hostOverrides,
  };
}
export const contactsModuleRow = {
  name: "contacts.core",
  status: "installed",
  recorded_status: "installed",
  reconciliation_required: false,
  maturity: "integration_tested" as const,
  version: "3.1.0-alpha.3",
  kind: "business_module",
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
export type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, reject, resolve };
}
export function jsonResponse(
  value: unknown,
  status = 200,
  totalCount?: number,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (totalCount !== undefined) headers.set("X-Total-Count", String(totalCount));
  return new Response(JSON.stringify(value), { status, headers });
}
export type ContactReadLane = "list" | "groups" | `detail:${string}`;
type CapturedRead = {
  authorization: string | undefined;
  lane: ContactReadLane;
  path: string;
  signal: AbortSignal | undefined;
};
export function createContactReadRouter() {
  const queues = new Map<ContactReadLane, Array<Deferred<Response>>>();
  const calls: CapturedRead[] = [];
  const fetchMock = vi.fn((
    input: RequestInfo | URL,
    request: RequestInit = {},
  ) => {
    const path = String(input);
    const lane = contactReadLane(path);
    const queue = queues.get(lane);
    const pending = queue?.shift();
    if (!pending) throw new Error(`No deferred response queued for ${lane}: ${path}`);
    const headers = request.headers as Record<string, string> | undefined;
    calls.push({
      authorization: headers?.Authorization,
      lane,
      path,
      signal: request.signal ?? undefined,
    });
    return pending.promise;
  });
  return {
    calls,
    callsFor: (lane: ContactReadLane) => calls.filter((call) => call.lane === lane),
    defer(lane: ContactReadLane) {
      const pending = deferred<Response>();
      queues.set(lane, [...(queues.get(lane) || []), pending]);
      return pending;
    },
    fetchMock,
  };
}

export async function resolveResponse(
  pending: Deferred<Response>,
  response: Response,
) {
  await act(async () => pending.resolve(response));
}

function contactReadLane(path: string): ContactReadLane {
  if (path.startsWith("/api/contacts?")) return "list";
  if (path === "/api/contacts/groups") return "groups";
  return `detail:${decodeURIComponent(path.split("/").at(-1) || "")}`;
}
