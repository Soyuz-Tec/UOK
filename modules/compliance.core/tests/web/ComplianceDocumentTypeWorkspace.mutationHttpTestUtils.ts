import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "../../web/src/types";

export type Deferred<Value> = {
  promise: Promise<Value>;
  resolve: (value: Value | PromiseLike<Value>) => void;
  reject: (reason?: unknown) => void;
};

export function deferred<Value>(): Deferred<Value> {
  let resolve!: Deferred<Value>["resolve"];
  let reject!: Deferred<Value>["reject"];
  const promise = new Promise<Value>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

export type ComplianceRequestKind = "command" | "list" | "detail" | "history";

export type ComplianceCommandEnvelope = {
  command_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

export type CapturedComplianceRequest = {
  sequence: number;
  kind: ComplianceRequestKind;
  path: string;
  method: string;
  authorization: string | null;
  signal: AbortSignal | undefined;
  documentTypeId: string | null;
  command: ComplianceCommandEnvelope | null;
};

export type ComplianceFetchResponder = (
  request: CapturedComplianceRequest,
) => Response | Promise<Response>;

export function freshJsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function freshInvalidJsonResponse(status = 200) {
  return new Response("{not-valid-json", {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function captureComplianceRequest(
  sequence: number,
  input: RequestInfo | URL,
  init?: RequestInit,
): CapturedComplianceRequest {
  const sourceRequest = input instanceof Request ? input : null;
  const path = sourceRequest?.url || String(input);
  const route = classifyRoute(path);
  const headers = new Headers(sourceRequest?.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return {
    sequence,
    kind: route.kind,
    path,
    method: init?.method || sourceRequest?.method || "GET",
    authorization: headers.get("Authorization"),
    signal: init?.signal || sourceRequest?.signal || undefined,
    documentTypeId: route.documentTypeId,
    command: route.kind === "command" ? parseCommand(init?.body) : null,
  };
}

export function complianceReadResponse(
  request: CapturedComplianceRequest,
  rows: ComplianceDocumentType[],
  history: Map<string, ComplianceDocumentTypeNameHistory[]>,
) {
  if (request.kind === "list") return freshJsonResponse(cloneRows(rows));
  const documentTypeId = request.documentTypeId || "";
  if (request.kind === "history") {
    return freshJsonResponse(cloneHistory(history.get(documentTypeId) || []));
  }
  const row = rows.find((candidate) => candidate.id === documentTypeId);
  return row
    ? freshJsonResponse({ ...row })
    : freshJsonResponse({ detail: "not found" }, 404);
}

export function cloneRows(rows: ComplianceDocumentType[]) {
  return rows.map((row) => ({ ...row }));
}

export function cloneHistory(entries: ComplianceDocumentTypeNameHistory[]) {
  return entries.map((entry) => ({ ...entry }));
}

function classifyRoute(path: string): {
  kind: ComplianceRequestKind;
  documentTypeId: string | null;
} {
  const pathname = new URL(path, "http://uok.test").pathname;
  if (pathname === "/api/commands") {
    return { kind: "command", documentTypeId: null };
  }
  const prefix = "/api/compliance/document-types";
  if (pathname === prefix) return { kind: "list", documentTypeId: null };
  if (!pathname.startsWith(`${prefix}/`)) {
    throw new Error(`Unexpected Compliance test request: ${path}.`);
  }
  const suffix = pathname.slice(prefix.length + 1);
  const [encodedId, child] = suffix.split("/");
  return {
    kind: child === "name-history" ? "history" : "detail",
    documentTypeId: decodeURIComponent(encodedId),
  };
}

function parseCommand(body: BodyInit | null | undefined): ComplianceCommandEnvelope {
  if (typeof body !== "string") {
    throw new Error("Compliance command test request must have a JSON string body.");
  }
  const value: unknown = JSON.parse(body);
  if (!isRecord(value)
    || typeof value.command_type !== "string"
    || !isRecord(value.payload)
    || typeof value.idempotency_key !== "string") {
    throw new Error("Compliance command test request has an invalid envelope.");
  }
  return {
    command_type: value.command_type,
    payload: value.payload,
    idempotency_key: value.idempotency_key,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
