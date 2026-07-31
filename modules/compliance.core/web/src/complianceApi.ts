import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeDraft,
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeNameHistory,
} from "./types";

type UnauthorizedHandler = () => void;
type ComplianceRequestContext = {
  onUnauthorized: UnauthorizedHandler;
  signal?: AbortSignal;
};
type ComplianceCommandResult = ComplianceDocumentType & { correlation_id: string };

export function loadComplianceDocumentTypes(
  token: string,
  request: ComplianceRequestContext,
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
  request: ComplianceRequestContext,
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
  request: ComplianceRequestContext,
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
  onUnauthorized: UnauthorizedHandler,
) {
  return complianceCommand(token, "CreateComplianceDocumentType", {
    code: draft.code.trim(),
    canonical_name: draft.canonicalName.trim(),
    description: optionalValue(draft.description),
    category: optionalValue(draft.category),
  }, "compliance-document-type-create", onUnauthorized);
}

export function updateComplianceDocumentType(
  token: string,
  documentType: ComplianceDocumentType,
  draft: ComplianceDocumentTypeDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return complianceCommand(token, "UpdateComplianceDocumentType", {
    compliance_document_type_id: documentType.id,
    expected_version: documentType.version,
    canonical_name: draft.canonicalName.trim(),
    description: optionalValue(draft.description),
    category: optionalValue(draft.category),
    reason: draft.reason.trim(),
  }, "compliance-document-type-update", onUnauthorized);
}

export function changeComplianceDocumentTypeLifecycle(
  token: string,
  documentType: ComplianceDocumentType,
  action: ComplianceDocumentTypeLifecycleAction,
  reason: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return complianceCommand(token, lifecycleCommands[action], {
    compliance_document_type_id: documentType.id,
    expected_version: documentType.version,
    reason: reason.trim(),
  }, `compliance-document-type-${action}`, onUnauthorized);
}

async function complianceCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await complianceJson<{ result: ComplianceCommandResult }>(
    token,
    "/api/commands",
    { onUnauthorized },
    {
      method: "POST",
      body: JSON.stringify({
        command_type: commandType,
        payload,
        idempotency_key: `${idempotencyPrefix}:${crypto.randomUUID()}`,
      }),
    },
  );
  return response.result;
}

async function complianceJson<T>(
  token: string,
  path: string,
  request: ComplianceRequestContext,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    signal: options.signal ?? request.signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) request.onUnauthorized();
    throw new Error(complianceErrorMessage(body, response.status));
  }
  return body as T;
}

const lifecycleCommands: Record<ComplianceDocumentTypeLifecycleAction, string> = {
  deactivate: "DeactivateComplianceDocumentType",
  activate: "ActivateComplianceDocumentType",
  archive: "ArchiveComplianceDocumentType",
  restore: "RestoreComplianceDocumentType",
};

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
