import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ComplianceDocumentType } from "../../web/src/types";
import {
  activeDocumentType,
  complianceHost,
  inactiveDocumentType,
  jsonResponse,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance Document Types interaction ordering", () => {
  it("reconciles selection through a filter and lifecycle action", async () => {
    let rows: ComplianceDocumentType[] = [activeDocumentType, inactiveDocumentType];
    const activateCommand = deferred<Response>();
    let commandStarted = false;
    vi.stubGlobal("crypto", { randomUUID: () => "44444444-4444-4444-8444-444444444444" });
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path === "/api/commands") {
        JSON.parse(String(request?.body));
        const activated = { ...inactiveDocumentType, status: "active" as const, version: 3 };
        rows = [activeDocumentType, activated];
        commandStarted = true;
        return activateCommand.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      if (path.includes("include_archived=true")) return jsonResponse(rows);
      const id = path.split("/").at(-1);
      return jsonResponse(rows.find((row) => row.id === id));
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });

    fireEvent.click(screen.getByRole("button", {
      name: "Search options: Current document types",
    }));
    fireEvent.change(screen.getByLabelText("Status filter"), {
      target: { value: "inactive" },
    });
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Tenant approved the type again" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Activate document type" }));

    await waitFor(() => expect(commandStarted).toBe(true));
    expect(screen.getByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    })).toBeInTheDocument();
    await act(async () => activateCommand.resolve(jsonResponse({
      result: {
        ...rows[1],
        correlation_id: "corr-activate",
      },
    })));
    await screen.findByRole("button", { name: "Deactivate document type" });
    expect(screen.getByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    })).toBeInTheDocument();
    expect(within(screen.getByRole("grid", {
      name: "Compliance document types",
    })).getByText(inactiveDocumentType.code)).toBeInTheDocument();
  });

  it("does not let an older refresh overwrite a completed mutation", async () => {
    let current: ComplianceDocumentType = activeDocumentType;
    let listCalls = 0;
    const staleRefresh = deferred<Response>();
    vi.stubGlobal("crypto", { randomUUID: () => "55555555-5555-4555-8555-555555555555" });
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path === "/api/commands") {
        JSON.parse(String(request?.body));
        current = { ...current, status: "inactive", version: 4 };
        return jsonResponse({ result: { ...current, correlation_id: "corr-deactivate" } });
      }
      if (path.includes("include_archived=true")) {
        listCalls += 1;
        return listCalls === 1 ? jsonResponse([current]) : staleRefresh.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(current);
    }));
    const host = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(listCalls).toBe(2));
    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Paused for tenant review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate document type" }));
    await screen.findByRole("button", { name: "Activate document type" });

    await act(async () => staleRefresh.resolve(jsonResponse([activeDocumentType])));
    expect(screen.getByRole("button", { name: "Activate document type" }))
      .toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `Deactivated ${activeDocumentType.canonical_name}.`,
    );
    expect(screen.queryByRole("button", { name: "Deactivate document type" }))
      .not.toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
