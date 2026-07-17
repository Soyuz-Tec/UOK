import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ComplianceDocumentType } from "../../web/src/types";
import {
  activeDocumentType,
  complianceHost,
  inactiveDocumentType,
  jsonResponse,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance Document Types session-safe reads", () => {
  it("ignores tenant A completion after logout and tenant B login", async () => {
    const tenantAList = deferred<Response>();
    const tenantBList = deferred<Response>();
    const tenantBType = {
      ...inactiveDocumentType,
      id: "tenant-b-type",
      canonical_name: "Tenant B Certificate",
    };
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      const authorization = (request?.headers as Record<string, string>)?.Authorization;
      if (path.includes("include_archived=true")) {
        return authorization === "Bearer tenant-a"
          ? tenantAList.promise
          : tenantBList.promise;
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse(tenantBType);
    }));
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      token: "tenant-a",
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    rerender(<ComplianceDocumentTypeWorkspace host={complianceHost({ token: "" })} />);
    expect(screen.getByText("Sign in to open Compliance Document Types.")).toBeInTheDocument();
    rerender(<ComplianceDocumentTypeWorkspace host={complianceHost({
      token: "tenant-b",
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));

    await act(async () => tenantBList.resolve(jsonResponse([tenantBType])));
    await screen.findByRole("heading", { name: tenantBType.canonical_name });
    await act(async () => tenantAList.resolve(jsonResponse([activeDocumentType])));

    expect(screen.getByRole("heading", {
      name: tenantBType.canonical_name,
    })).toBeInTheDocument();
    expect(screen.queryByText(activeDocumentType.code)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 compliance document type(s) loaded.");
  });

  it("clears A history when B history fails", async () => {
    const rows: ComplianceDocumentType[] = [activeDocumentType, inactiveDocumentType];
    const failedHistory = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("include_archived=true")) return jsonResponse(rows);
      if (path.includes(`${inactiveDocumentType.id}/name-history`)) {
        return failedHistory.promise;
      }
      if (path.includes("name-history")) return jsonResponse(nameHistory);
      const id = path.split("/").at(-1);
      return jsonResponse(rows.find((row) => row.id === id));
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByText("Ocean Bill → Bill of Lading");

    fireEvent.click(screen.getByRole("row", {
      name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
    }));

    expect(screen.queryByText("Ocean Bill → Bill of Lading")).not.toBeInTheDocument();
    expect(screen.getByText("Loading name history.")).toBeInTheDocument();
    await act(async () => failedHistory.resolve(
      jsonResponse({ detail: "B history unavailable" }, 503),
    ));
    await screen.findByText("B history unavailable");
    expect(screen.getByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    })).toBeInTheDocument();
    expect(screen.getByText("No canonical name changes have been recorded."))
      .toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
