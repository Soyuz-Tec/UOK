import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import {
  createComplianceMutationFetchController,
  freshJsonResponse,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  activeDocumentType,
  complianceHost,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Compliance mutation response hints", () => {
  it("publishes the reconciled server name instead of a stale command response", async () => {
    const controller = createComplianceMutationFetchController({
      rows: [activeDocumentType],
    });
    const response = controller.deferNext("command");
    vi.stubGlobal("fetch", controller.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Authoritative response proof" },
    });
    fireEvent.click(screen.getByRole("button", {
      name: "Deactivate document type",
    }));
    await waitFor(() => expect(controller.requestsOf("command")).toHaveLength(1));

    const authoritative = {
      ...activeDocumentType,
      canonical_name: "Authoritative shipping document",
      status: "inactive" as const,
      version: 5,
    };
    controller.upsert(authoritative);
    await act(async () => response.resolve(freshJsonResponse({
      result: {
        ...authoritative,
        canonical_name: "Stale command response name",
        version: 4,
        correlation_id: "corr-response-hint",
      },
    })));

    await screen.findByRole("heading", { name: authoritative.canonical_name });
    expect(screen.getByRole("status")).toHaveTextContent(
      `Deactivated ${authoritative.canonical_name}.`,
    );
    expect(screen.queryByText(/Stale command response name/)).not.toBeInTheDocument();
  });
});
