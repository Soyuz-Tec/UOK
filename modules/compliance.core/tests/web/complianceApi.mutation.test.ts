import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createComplianceDocumentType,
  isComplianceApiError,
  type ComplianceApiError,
  type ComplianceCommandRequest,
} from "../../web/src/complianceApi";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeDraft,
} from "../../web/src/types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance command transport", () => {
  it("uses the caller-owned idempotency key and does not make commands abortable", async () => {
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _options?: RequestInit,
    ) => jsonResponse({ result: commandResult }));
    vi.stubGlobal("fetch", fetchMock);

    await createComplianceDocumentType("test-token", draft, commandRequest());

    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/commands");
    expect(options).not.toHaveProperty("signal");
    expect(JSON.parse(String(options?.body))).toEqual({
      command_type: "CreateComplianceDocumentType",
      payload: {
        code: "BILL-OF-LADING",
        canonical_name: "Bill of Lading",
        description: null,
        category: "Transport",
      },
      idempotency_key: "compliance-intent-1",
    });
  });

  it("invokes the current request unauthorized handler and throws a typed 401", async () => {
    const onUnauthorized = vi.fn();
    const body = { detail: "Session expired." };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, 401)));

    const error = await capturedError(createComplianceDocumentType(
      "test-token",
      draft,
      commandRequest({ onUnauthorized }),
    ));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expectApiError(error, {
      status: 401,
      body,
      ambiguous: false,
    });
  });

  it("preserves a typed ambiguous 5xx body for post-command reconciliation", async () => {
    const body = { detail: "Command service unavailable." };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, 503)));

    const error = await capturedError(createComplianceDocumentType(
      "test-token",
      draft,
      commandRequest(),
    ));

    expectApiError(error, {
      status: 503,
      body,
      ambiguous: true,
    });
  });

  it("rejects a malformed successful command result as an ambiguous typed error", async () => {
    const body = { result: { id: "incomplete-result" } };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)));

    const error = await capturedError(createComplianceDocumentType(
      "test-token",
      draft,
      commandRequest(),
    ));

    expectApiError(error, {
      status: 200,
      body,
      ambiguous: true,
    });
    expect((error as Error).message).toContain("server outcome is ambiguous");
  });
});

const draft: ComplianceDocumentTypeDraft = {
  code: " BILL-OF-LADING ",
  canonicalName: " Bill of Lading ",
  description: " ",
  category: " Transport ",
  reason: "",
};

const commandResult: ComplianceDocumentType & { correlation_id: string } = {
  id: "document-type-1",
  code: "BILL-OF-LADING",
  canonical_name: "Bill of Lading",
  description: null,
  category: "Transport",
  status: "active",
  version: 1,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-31T10:00:00Z",
  updated_at: "2026-07-31T10:00:00Z",
  archived_at: null,
  correlation_id: "command-1",
};

function commandRequest(
  overrides: Partial<ComplianceCommandRequest> = {},
): ComplianceCommandRequest {
  return {
    idempotencyKey: "compliance-intent-1",
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function capturedError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the Compliance command request to fail.");
}

function expectApiError(
  error: unknown,
  expected: Pick<ComplianceApiError, "status" | "body" | "ambiguous">,
) {
  expect(isComplianceApiError(error)).toBe(true);
  expect(error).toMatchObject({
    name: "ComplianceApiError",
    ...expected,
  });
}
