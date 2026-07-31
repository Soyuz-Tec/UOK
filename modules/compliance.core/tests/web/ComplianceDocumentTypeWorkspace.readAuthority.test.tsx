import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import {
  activeDocumentType,
  complianceHost,
  deferred,
  inactiveDocumentType,
  jsonResponse,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance read request authority", () => {
  it("masks committed data and rejects a non-abortable same-token ABA completion", async () => {
    const middleList = deferred<Response>();
    const replacementList = deferred<Response>();
    const replacement = {
      ...inactiveDocumentType,
      id: "replacement-type",
      canonical_name: "Replacement Generation Certificate",
    };
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        if (listCalls === 1) return jsonResponse([activeDocumentType]);
        return listCalls === 2 ? middleList.promise : replacementList.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(path.includes(replacement.id) ? replacement : activeDocumentType);
    }));
    const base = complianceHost({
      session: { token: "stable-token", generation: 0 },
    });
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      session: { ...base.session, generation: 1 },
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      session: { ...base.session, generation: 2 },
    }} />);
    await waitFor(() => expect(listCalls).toBe(3));
    await act(async () => middleList.resolve(jsonResponse([activeDocumentType])));
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();

    await act(async () => replacementList.resolve(jsonResponse([replacement])));
    await screen.findByRole("heading", { name: replacement.canonical_name });
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();
  });

  it("suppresses a stale list 401 and handles the current generation once", async () => {
    const staleList = deferred<Response>();
    const currentList = deferred<Response>();
    const onUnauthorized = vi.fn();
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes("include_archived=true")) return jsonResponse([]);
      listCalls += 1;
      return listCalls === 1 ? staleList.promise : currentList.promise;
    }));
    const base = complianceHost({
      session: { token: "stable-token", generation: 0, onUnauthorized },
    });
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await waitFor(() => expect(listCalls).toBe(1));
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      session: { ...base.session, generation: 1 },
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));

    await act(async () => staleList.resolve(jsonResponse({ detail: "stale" }, 401)));
    expect(onUnauthorized).not.toHaveBeenCalled();
    await act(async () => currentList.resolve(jsonResponse({ detail: "current" }, 401)));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it("shares one guarded unauthorized decision across detail and history", async () => {
    const detail = deferred<Response>();
    const history = deferred<Response>();
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) return jsonResponse([activeDocumentType]);
      if (path.includes("name-history")) return history.promise;
      return detail.promise;
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      session: { onUnauthorized },
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

    await act(async () => {
      detail.resolve(jsonResponse({ detail: "expired detail" }, 401));
      history.resolve(jsonResponse({ detail: "expired history" }, 401));
    });
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it("disposes pending unauthorized work on unmount", async () => {
    const pendingList = deferred<Response>();
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => pendingList.promise));
    const { unmount } = render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      session: { onUnauthorized },
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => pendingList.resolve(jsonResponse({ detail: "late" }, 401)));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("rejects stale detail and history across an A to B to A selection", async () => {
    const firstDetail = deferred<Response>();
    const firstHistory = deferred<Response>();
    const middleDetail = deferred<Response>();
    const middleHistory = deferred<Response>();
    const currentDetail = deferred<Response>();
    const currentHistory = deferred<Response>();
    const onUnauthorized = vi.fn();
    let activeDetailCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        return jsonResponse([activeDocumentType, inactiveDocumentType]);
      }
      const active = path.includes(activeDocumentType.id);
      if (path.includes("name-history")) {
        if (!active) return middleHistory.promise;
        activeDetailCalls += 1;
        return activeDetailCalls === 1 ? firstHistory.promise : currentHistory.promise;
      }
      if (!active) return middleDetail.promise;
      return activeDetailCalls === 0 ? firstDetail.promise : currentDetail.promise;
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      session: { onUnauthorized },
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole("row", {
      name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
    }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5));
    fireEvent.click(screen.getByRole("row", {
      name: `${activeDocumentType.code} ${activeDocumentType.canonical_name}`,
    }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(7));

    await act(async () => {
      firstDetail.resolve(jsonResponse(activeDocumentType));
      firstHistory.resolve(jsonResponse({ detail: "stale selection" }, 401));
    });
    expect(onUnauthorized).not.toHaveBeenCalled();

    await act(async () => {
      currentDetail.resolve(jsonResponse(activeDocumentType));
      currentHistory.resolve(jsonResponse([{
        id: "current-history",
        compliance_document_type_id: activeDocumentType.id,
        previous_name: "Current Name",
        new_name: activeDocumentType.canonical_name,
        reason: "Current request",
        changed_by_user_id: "current-user",
        changed_at: "2026-07-17T12:00:00Z",
      }]));
    });
    await screen.findByText("Current Name → Bill of Lading");

    await act(async () => {
      middleDetail.resolve(jsonResponse(inactiveDocumentType));
      middleHistory.resolve(jsonResponse([]));
    });
    expect(screen.getByText("Current Name → Bill of Lading")).toBeInTheDocument();
  });
});
