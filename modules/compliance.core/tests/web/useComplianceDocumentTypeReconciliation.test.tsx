import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRequestAuthority } from "@uok/shared/request-authority";
import { beginComplianceRead } from "../../web/src/complianceReadAuthority";
import type {
  ComplianceReconciliationSnapshot,
} from "../../web/src/complianceReadReconciliation";
import { useComplianceDocumentTypeReconciliation } from "../../web/src/useComplianceDocumentTypeReconciliation";
import { activeDocumentType } from "./ComplianceDocumentTypeWorkspace.testUtils";
import { deferred } from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";

const loadSnapshot = vi.hoisted(() => vi.fn());

vi.mock("../../web/src/complianceReadReconciliation", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../web/src/complianceReadReconciliation")
  >();
  return { ...actual, loadComplianceReconciliationSnapshot: loadSnapshot };
});

afterEach(() => vi.clearAllMocks());

describe("useComplianceDocumentTypeReconciliation", () => {
  it("rejects a preferred selection that becomes stale before commit", async () => {
    const pending = deferred<ComplianceReconciliationSnapshot | null>();
    loadSnapshot.mockReturnValueOnce(pending.promise);
    const authority = createRequestAuthority();
    const boundaryRef = {
      current: {
        token: "token-a",
        generation: 0,
        role: "platform_admin",
        operational: true,
        surfaceActive: true,
      },
    };
    const onApplied = vi.fn();
    let preferenceCurrent = true;
    const { result } = renderHook(() => useComplianceDocumentTypeReconciliation({
      authority,
      boundaryRef,
      beginRead: (lane) => beginComplianceRead(
        authority,
        boundaryRef,
        { current: vi.fn() },
        vi.fn(),
        lane,
      ),
      current: {
        rows: [activeDocumentType],
        selectedId: activeDocumentType.id,
        detail: activeDocumentType,
        history: [],
      },
      onApplied,
      onRefreshing: vi.fn(),
      onStatus: vi.fn(),
    }));

    const reconciliation = result.current.reconcileDocumentTypes({
      preferredSelectedId: "new-document",
      preferenceIsCurrent: () => preferenceCurrent,
    });
    await vi.waitFor(() => expect(loadSnapshot).toHaveBeenCalledOnce());
    preferenceCurrent = false;
    await act(async () => pending.resolve({
      rows: [{ ...activeDocumentType, id: "new-document" }],
      selectedId: "new-document",
      detail: { ...activeDocumentType, id: "new-document" },
      history: [],
    }));

    await expect(reconciliation).resolves.toEqual({ kind: "superseded" });
    expect(onApplied).not.toHaveBeenCalled();
  });
});
