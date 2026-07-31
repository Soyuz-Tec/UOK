import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "../../web/src/types";

export const activeDocumentType: ComplianceDocumentType = {
  id: "document-type-1",
  code: "BILL-OF-LADING",
  canonical_name: "Bill of Lading",
  description: "Transport document issued for the governed movement.",
  category: "Transport",
  status: "active",
  version: 3,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T11:00:00Z",
  archived_at: null,
};

export const inactiveDocumentType: ComplianceDocumentType = {
  ...activeDocumentType,
  id: "document-type-2",
  code: "PHYTOSANITARY-CERTIFICATE",
  canonical_name: "Phytosanitary Certificate",
  description: "Tenant-reviewed sanitary evidence vocabulary.",
  category: "Sanitary",
  status: "inactive",
  version: 2,
};

export const archivedDocumentType: ComplianceDocumentType = {
  ...activeDocumentType,
  id: "document-type-3",
  code: "LEGACY-CERTIFICATE",
  canonical_name: "Legacy Certificate",
  description: null,
  category: "Origin",
  status: "archived",
  version: 5,
  archived_at: "2026-07-17T12:00:00Z",
};

export const nameHistory: ComplianceDocumentTypeNameHistory[] = [{
  id: "history-1",
  compliance_document_type_id: activeDocumentType.id,
  previous_name: "Ocean Bill",
  new_name: activeDocumentType.canonical_name,
  reason: "Tenant vocabulary review",
  changed_by_user_id: "user-1",
  changed_at: "2026-07-17T11:00:00Z",
}];

type HostOverrides = Omit<Partial<ModuleSurfaceRenderContext>, "session"> & {
  session?: Partial<ModuleSurfaceRenderContext["session"]>;
};

export function complianceHost(overrides: HostOverrides = {}): ModuleSurfaceRenderContext {
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
    moduleRows: [complianceModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    surfaceActive: true,
    ...hostOverrides,
  };
}

export const complianceModuleRow = {
  name: "compliance.core",
  status: "installed",
  recorded_status: "installed",
  reconciliation_required: false,
  maturity: "integration_tested" as const,
  version: "3.1.0-alpha.3",
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

export function complianceFetchMock(options: {
  rows?: () => ComplianceDocumentType[];
  history?: () => ComplianceDocumentTypeNameHistory[];
  command?: (body: Record<string, unknown>) => ComplianceDocumentType;
} = {}) {
  const rows = options.rows || (() => [
    activeDocumentType,
    inactiveDocumentType,
    archivedDocumentType,
  ]);
  return vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const path = String(input);
    if (path === "/api/commands") {
      const body = JSON.parse(String(request?.body));
      const result = options.command?.(body) || activeDocumentType;
      return jsonResponse({ result: { ...result, correlation_id: "corr-compliance" } });
    }
    if (path.includes("name-history")) {
      return jsonResponse(options.history?.() || nameHistory);
    }
    if (path.includes("include_archived=true")) return jsonResponse(rows());
    if (path.startsWith("/api/compliance/document-types/")) {
      const id = path.split("/").at(-1);
      const row = rows().find((candidate) => candidate.id === id);
      return row ? jsonResponse(row) : jsonResponse({ detail: "not found" }, 404);
    }
    return jsonResponse({ detail: "not found" }, 404);
  });
}

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
