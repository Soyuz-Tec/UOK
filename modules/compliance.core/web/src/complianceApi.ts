import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeDraft,
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeNameHistory,
} from "./types";

type UnauthorizedHandler = () => void;

export type ComplianceReadRequest = {
  onUnauthorized: UnauthorizedHandler;
  signal?: AbortSignal;
};

export type ComplianceCommandRequest = {
  onUnauthorized: UnauthorizedHandler;
  idempotencyKey: string;
};

type ComplianceCommandResult = ComplianceDocumentType & { correlation_id: string };

export function loadComplianceDocumentTypes(
  token: string,
  request: ComplianceReadRequest,
) {
  return complianceJson<ComplianceDocumentType[]>(
    token,
    "/api/compliance/document-types?include_archived=true",
    request,
  );
}

export function loadComplianceDocumentType(
  token: string,
  documentTypeId: string,
  request: ComplianceReadRequest,
) {
  return complianceJson<ComplianceDocumentType>(
    token,
    `/api/compliance/document-types/${documentTypeId}`,
    request,
  );
}

export function loadComplianceDocumentTypeNameHistory(
  token: string,
  documentTypeId: string,
  request: ComplianceReadRequest,
) {
  return complianceJson<ComplianceDocumentTypeNameHistory[]>(
    token,
    `/api/compliance/document-types/${documentTypeId}/name-history`,
    request,
  );
}

export function createComplianceDocumentType(
  token: string,
  draft: ComplianceDocumentTypeDraft,
  request: ComplianceCommandRequest,
) {
  return complianceCommand(token, "CreateComplianceDocumentType", {
    code: draft.code.trim(),
    canonical_name: draft.canonicalName.trim(),
    description: optionalValue(draft.description),
    category: optionalValue(draft.category),
  }, request);
}

export function updateComplianceDocumentType(
  token: string,
  documentType: ComplianceDocumentType,
  draft: ComplianceDocumentTypeDraft,
  request: ComplianceCommandRequest,
) {
  return complianceCommand(token, "UpdateComplianceDocumentType", {
    compliance_document_type_id: documentType.id,
    expected_version: documentType.version,
    canonical_name: draft.canonicalName.trim(),
    description: optionalValue(draft.description),
    category: optionalValue(draft.category),
    reason: draft.reason.trim(),
  }, request);
}

export function changeComplianceDocumentTypeLifecycle(
  token: string,
  documentType: ComplianceDocumentType,
  action: ComplianceDocumentTypeLifecycleAction,
  reason: string,
  request: ComplianceCommandRequest,
) {
  return complianceCommand(token, lifecycleCommands[action], {
    compliance_document_type_id: documentType.id,
    expected_version: documentType.version,
    reason: reason.trim(),
  }, request);
}

async function complianceCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  request: ComplianceCommandRequest,
) {
  return complianceJson<ComplianceDocumentType>(
    token,
    "/api/commands",
    {
      onUnauthorized: request.onUnauthorized,
      ambiguousServerFailure: true,
    },
    {
      method: "POST",
      body: JSON.stringify({
        command_type: commandType,
        payload,
        idempotency_key: request.idempotencyKey,
      }),
    },
    decodeComplianceCommandResult,
  );
}

type ComplianceTransportRequest = {
  onUnauthorized: UnauthorizedHandler;
  signal?: AbortSignal;
  ambiguousServerFailure?: boolean;
};

async function complianceJson<T>(
  token: string,
  path: string,
  request: ComplianceTransportRequest,
  options: RequestInit = {},
  decode: (body: unknown, status: number) => T = (body) => body as T,
): Promise<T> {
  const signal = options.signal ?? request.signal;
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  };
  if (signal) requestOptions.signal = signal;
  const response = await fetch(path, requestOptions);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) request.onUnauthorized();
    throw new ComplianceApiError(
      complianceErrorMessage(body, response.status),
      response.status,
      body,
      Boolean(request.ambiguousServerFailure && response.status >= 500),
    );
  }
  return decode(body, response.status);
}

export class ComplianceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly ambiguous = false,
  ) {
    super(message);
    this.name = "ComplianceApiError";
  }
}

export function isComplianceApiError(error: unknown): error is ComplianceApiError {
  return error instanceof ComplianceApiError;
}

const lifecycleCommands: Record<ComplianceDocumentTypeLifecycleAction, string> = {
  deactivate: "DeactivateComplianceDocumentType",
  activate: "ActivateComplianceDocumentType",
  archive: "ArchiveComplianceDocumentType",
  restore: "RestoreComplianceDocumentType",
};

function decodeComplianceCommandResult(body: unknown, status: number) {
  if (
    body
    && typeof body === "object"
    && !Array.isArray(body)
    && "result" in body
    && isComplianceCommandResult(body.result)
  ) {
    return body.result;
  }
  throw new ComplianceApiError(
    "Compliance command response was invalid; the server outcome is ambiguous.",
    status,
    body,
    true,
  );
}

function isComplianceCommandResult(value: unknown): value is ComplianceCommandResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.code === "string"
    && typeof row.canonical_name === "string"
    && optionalString(row.description)
    && optionalString(row.category)
    && ["active", "inactive", "archived"].includes(String(row.status))
    && Number.isInteger(row.version)
    && Number(row.version) >= 1
    && typeof row.created_by_user_id === "string"
    && typeof row.updated_by_user_id === "string"
    && typeof row.created_at === "string"
    && typeof row.updated_at === "string"
    && optionalString(row.archived_at)
    && typeof row.correlation_id === "string"
    && row.correlation_id.length > 0;
}

function optionalString(value: unknown) {
  return value === null || typeof value === "string";
}

function optionalValue(value: string) {
  return value.trim() || null;
}

function complianceErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (record.detail && typeof record.detail === "object") {
      const detail = record.detail as Record<string, unknown>;
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.error === "string") return detail.error;
    }
    if (record.error && typeof record.error === "object") {
      const error = record.error as Record<string, unknown>;
      if (typeof error.message === "string") return error.message;
    }
  }
  return `Compliance Document Types request failed with HTTP ${status}.`;
}
