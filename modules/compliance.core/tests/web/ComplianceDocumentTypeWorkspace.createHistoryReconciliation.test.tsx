import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ComplianceDocumentType } from "../../web/src/types";
import {
  createComplianceMutationFetchController,
  freshJsonResponse,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  activeDocumentType,
  complianceHost,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance create history reconciliation", () => {
  it("does not carry owner A history into a newly created owner C", async () => {
    const created: ComplianceDocumentType = {
      ...activeDocumentType,
      id: "document-type-created-c",
      code: "CERTIFICATE-OF-ORIGIN",
      canonical_name: "Certificate of Origin",
      description: null,
      category: "Origin",
      version: 1,
    };
    const server = createComplianceMutationFetchController({
      rows: [activeDocumentType],
      history: { [activeDocumentType.id]: nameHistory },
    });
    const command = server.deferNext("command");
    vi.stubGlobal("crypto", {
      randomUUID: () => "33333333-3333-4333-8333-333333333333",
    });
    vi.stubGlobal("fetch", server.fetch);

    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByText("Ocean Bill → Bill of Lading");

    fireEvent.click(screen.getByRole("button", { name: "New document type" }));
    const editor = within(screen.getByRole("dialog", {
      name: "Create compliance document type",
    }));
    fireEvent.change(editor.getByLabelText("Document type code"), {
      target: { value: created.code },
    });
    fireEvent.change(editor.getByLabelText("Canonical name"), {
      target: { value: created.canonical_name },
    });
    fireEvent.click(editor.getByRole("button", { name: "Create document type" }));

    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    server.upsert(created);
    server.setHistory(created.id, []);
    await act(async () => {
      command.resolve(freshJsonResponse({
        result: { ...created, correlation_id: "corr-create-c" },
      }));
    });

    await screen.findByRole("heading", { name: created.canonical_name });
    const history = screen.getByRole("region", { name: "Canonical name history" });
    expect(within(history).queryByText("Ocean Bill → Bill of Lading"))
      .not.toBeInTheDocument();
    expect(within(history).getByText(
      "No canonical name changes have been recorded.",
    )).toBeInTheDocument();
    expect(server.requestsOf("history").at(-1)?.documentTypeId).toBe(created.id);
    expect(server.requestsOf("history").at(-1)!.sequence)
      .toBeGreaterThan(server.requestsOf("command")[0].sequence);
    expect(server.requestsOf("command")).toHaveLength(1);
  });
});
