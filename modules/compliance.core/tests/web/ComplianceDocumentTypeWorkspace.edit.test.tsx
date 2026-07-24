import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ComplianceDocumentType } from "../../web/src/types";
import {
  activeDocumentType,
  complianceFetchMock,
  complianceHost,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance Document Types create and edit", () => {
  it("creates through the command bus with trimmed optional values", async () => {
    let rows: ComplianceDocumentType[] = [activeDocumentType];
    const commands: Record<string, unknown>[] = [];
    const created: ComplianceDocumentType = {
      ...activeDocumentType,
      id: "document-type-created",
      code: "CERTIFICATE-OF-ORIGIN",
      canonical_name: "Certificate of Origin",
      description: null,
      category: "Origin",
      version: 1,
    };
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", complianceFetchMock({
      rows: () => rows,
      command: (body) => {
        commands.push(body);
        rows = [created, ...rows];
        return created;
      },
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });

    fireEvent.click(screen.getByRole("button", { name: "New document type" }));
    const editor = within(screen.getByRole("dialog", {
      name: "Create compliance document type",
    }));
    fireEvent.change(editor.getByLabelText("Document type code"), {
      target: { value: " certificate-of-origin " },
    });
    fireEvent.change(editor.getByLabelText("Canonical name"), {
      target: { value: created.canonical_name },
    });
    fireEvent.change(editor.getByLabelText("Category"), {
      target: { value: " Origin " },
    });
    fireEvent.click(editor.getByRole("button", { name: "Create document type" }));

    await screen.findByRole("heading", { name: created.canonical_name });
    expect(commands[0]).toMatchObject({
      command_type: "CreateComplianceDocumentType",
      payload: {
        code: "certificate-of-origin",
        canonical_name: created.canonical_name,
        description: null,
        category: "Origin",
      },
    });
  });

  it("requires a real reasoned change and sends the current optimistic version", async () => {
    let rows: ComplianceDocumentType[] = [activeDocumentType];
    let updated = false;
    const commands: Record<string, unknown>[] = [];
    const changed: ComplianceDocumentType = {
      ...activeDocumentType,
      canonical_name: "Governed Bill of Lading",
      description: "Updated tenant vocabulary.",
      version: 4,
    };
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", complianceFetchMock({
      rows: () => rows,
      history: () => updated ? [{
        ...nameHistory[0],
        id: "history-2",
        previous_name: activeDocumentType.canonical_name,
        new_name: changed.canonical_name,
        reason: "Operations terminology",
      }, ...nameHistory] : nameHistory,
      command: (body) => {
        commands.push(body);
        updated = true;
        rows = [changed];
        return changed;
      },
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByText("Ocean Bill → Bill of Lading");

    fireEvent.click(screen.getByRole("button", { name: "Edit document type" }));
    expect(screen.getByRole("button", { name: "Save document type" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Canonical name"), {
      target: { value: changed.canonical_name },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: changed.description },
    });
    fireEvent.change(screen.getByLabelText("Change reason"), {
      target: { value: "Operations terminology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save document type" }));

    await screen.findByText("Bill of Lading → Governed Bill of Lading");
    expect(commands[0]).toMatchObject({
      command_type: "UpdateComplianceDocumentType",
      payload: {
        compliance_document_type_id: activeDocumentType.id,
        expected_version: 3,
        canonical_name: changed.canonical_name,
        description: changed.description,
        category: "Transport",
        reason: "Operations terminology",
      },
    });
  });
});
