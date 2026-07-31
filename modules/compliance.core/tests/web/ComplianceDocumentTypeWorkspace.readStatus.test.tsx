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

describe("Compliance read authority status and role transitions", () => {
  it("suppresses a stale same-session 401 after a role transition", async () => {
    const staleList = deferred<Response>();
    const currentList = deferred<Response>();
    const onUnauthorized = vi.fn();
    let listCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        return listCalls === 1 ? staleList.promise : currentList.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(activeDocumentType);
    }));
    const base = complianceHost({
      currentUserRole: "ops_manager",
      session: { onUnauthorized },
    });
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={base} />);
    await waitFor(() => expect(listCalls).toBe(1));
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...base,
      currentUserRole: "viewer",
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));

    await act(async () => staleList.resolve(jsonResponse({ detail: "stale" }, 401)));
    expect(onUnauthorized).not.toHaveBeenCalled();
    await act(async () => currentList.resolve(jsonResponse([activeDocumentType])));
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("removes an entity A detail error when entity B becomes authoritative", async () => {
    const bDetail = deferred<Response>();
    const bHistory = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) {
        return jsonResponse([activeDocumentType, inactiveDocumentType]);
      }
      if (path.includes(inactiveDocumentType.id)) {
        return path.includes("name-history") ? bHistory.promise : bDetail.promise;
      }
      if (path.includes("name-history")) {
        return jsonResponse({ detail: "A detail denied" }, 403);
      }
      return jsonResponse(activeDocumentType);
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByText("A detail denied");

    fireEvent.click(screen.getByRole("row", {
      name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
    }));
    expect(screen.queryByText("A detail denied")).not.toBeInTheDocument();
    expect(screen.getByText("2 compliance document type(s) loaded."))
      .toBeInTheDocument();
    await act(async () => {
      bDetail.resolve(jsonResponse(inactiveDocumentType));
      bHistory.resolve(jsonResponse([]));
    });
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });
    expect(screen.queryByText("A detail denied")).not.toBeInTheDocument();
  });
});
