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
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance retained-surface read authority", () => {
  it("invalidates hidden work, ignores presentation rerenders, and reconciles on activation", async () => {
    const hiddenRefresh = deferred<Response>();
    const activeRefresh = deferred<Response>();
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        if (listCalls === 1) return jsonResponse([activeDocumentType]);
        return listCalls === 2 ? hiddenRefresh.promise : activeRefresh.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(path.includes(inactiveDocumentType.id)
        ? inactiveDocumentType
        : activeDocumentType);
    }));
    const base = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    expect(screen.getByText("1 compliance document type(s) loaded."))
      .toBeInTheDocument();

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      appearance: "dark",
      moduleRefreshRevision: 1,
      surfaceActive: false,
    }} />);
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      appearance: "light",
      moduleRefreshRevision: 1,
      surfaceActive: false,
    }} />);
    expect(listCalls).toBe(2);
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      appearance: "light",
      moduleRefreshRevision: 1,
      surfaceActive: true,
    }} />);
    await waitFor(() => expect(listCalls).toBe(3));
    await act(async () => hiddenRefresh.resolve(
      jsonResponse({ detail: "stale hidden failure" }, 503),
    ));
    expect(screen.queryByText("stale hidden failure")).not.toBeInTheDocument();
    expect(screen.getByText("Compliance Document Types ready.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "Working" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await act(async () => activeRefresh.resolve(jsonResponse([inactiveDocumentType])));
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      appearance: "dark",
      moduleRefreshRevision: 1,
      surfaceActive: true,
    }} />);
    expect(listCalls).toBe(3);
  });

  it("keeps list and detail lanes independent", async () => {
    const detail = deferred<Response>();
    const history = deferred<Response>();
    let listCalls = 0;
    const detailSignals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        return jsonResponse([activeDocumentType]);
      }
      if (path.includes("name-history")) return history.promise;
      if (request?.signal) detailSignals.push(request.signal);
      return detail.promise;
    }));
    const base = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));
    expect(detailSignals[0]?.aborted).toBe(false);
    await act(async () => {
      detail.resolve(jsonResponse(activeDocumentType));
      history.resolve(jsonResponse(nameHistory));
    });
    await screen.findByText("Ocean Bill → Bill of Lading");
  });

  it("invalidates reads across operational disable and re-enable", async () => {
    const staleList = deferred<Response>();
    const currentList = deferred<Response>();
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        return listCalls === 1 ? staleList.promise : currentList.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(inactiveDocumentType);
    }));
    const base = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await waitFor(() => expect(listCalls).toBe(1));
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      moduleRows: base.moduleRows.map((row) => ({ ...row, status: "disabled" })),
    }} />);
    await act(async () => staleList.resolve(jsonResponse([activeDocumentType])));
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();

    rerender(<ComplianceDocumentTypeWorkspace host={base} />);
    await waitFor(() => expect(listCalls).toBe(2));
    await act(async () => currentList.resolve(jsonResponse([inactiveDocumentType])));
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });
  });
});
