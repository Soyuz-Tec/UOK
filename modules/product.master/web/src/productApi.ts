import type { ProductDefinition, ProductDraft, ProductNameHistory } from "./types";

type UnauthorizedHandler = () => void;
type ProductCommandResult = ProductDefinition & { correlation_id: string };

export function loadProductDefinitions(token: string, onUnauthorized: UnauthorizedHandler) {
  return productJson<ProductDefinition[]>(
    token,
    "/api/products/definitions?include_archived=true",
    onUnauthorized,
  );
}

export function loadProductNameHistory(
  token: string,
  productDefinitionId: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return productJson<ProductNameHistory[]>(
    token,
    `/api/products/definitions/${productDefinitionId}/name-history`,
    onUnauthorized,
  );
}

export function createProductDefinition(
  token: string,
  draft: ProductDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return productCommand(token, "CreateProductDefinition", {
    code: draft.code.trim(),
    canonical_name: draft.canonicalName.trim(),
    ...optionalProductFields(draft),
  }, "product-create", onUnauthorized);
}

export function updateProductDefinition(
  token: string,
  product: ProductDefinition,
  draft: ProductDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return productCommand(token, "UpdateProductDefinition", {
    product_definition_id: product.id,
    expected_version: product.version,
    canonical_name: draft.canonicalName.trim(),
    ...optionalProductFields(draft),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  }, "product-update", onUnauthorized);
}

export function archiveProductDefinition(
  token: string,
  product: ProductDefinition,
  onUnauthorized: UnauthorizedHandler,
) {
  return productCommand(token, "ArchiveProductDefinition", {
    product_definition_id: product.id,
    expected_version: product.version,
  }, "product-archive", onUnauthorized);
}

export function restoreProductDefinition(
  token: string,
  product: ProductDefinition,
  onUnauthorized: UnauthorizedHandler,
) {
  return productCommand(token, "RestoreProductDefinition", {
    product_definition_id: product.id,
    expected_version: product.version,
  }, "product-restore", onUnauthorized);
}

async function productCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await productJson<{ result: ProductCommandResult }>(
    token,
    "/api/commands",
    onUnauthorized,
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

async function productJson<T>(
  token: string,
  path: string,
  onUnauthorized: UnauthorizedHandler,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new Error(productErrorMessage(body, response.status));
  }
  return body as T;
}

function optionalProductFields(draft: ProductDraft) {
  return {
    category: optionalText(draft.category),
    grade: optionalText(draft.grade),
    specification: optionalText(draft.specification),
    base_unit_code: optionalText(draft.baseUnitCode)?.toUpperCase(),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function productErrorMessage(body: unknown, status: number) {
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
  return `Product Master request failed with HTTP ${status}.`;
}
