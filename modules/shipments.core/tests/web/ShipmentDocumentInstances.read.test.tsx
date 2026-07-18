import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentInstancesPanel } from "../../web/src/ShipmentDocumentInstancesPanel";
import {
  instanceFetchMock,
  instancePanelProps,
  invoiceInstance,
  invoiceType,
  jsonResponse,
  requirementResponse,
} from "./ShipmentDocumentInstances.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document instance reads", () => {
  it("renders bounded metadata and hides mutation controls from viewers", async () => {
    vi.stubGlobal("fetch", instanceFetchMock({ instances: () => [invoiceInstance] }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps({ canManage: false })} />);

    expect(await screen.findByText("COMMERCIAL-INVOICE · Commercial Invoice"))
      .toBeInTheDocument();
    expect(screen.getByText("INV-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("Kayilan Export Partner")).toBeInTheDocument();
    expect(screen.getByText("required · missing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add document metadata" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit COMMERCIAL-INVOICE/ }))
      .not.toBeInTheDocument();
  });

  it("uses safe owner redaction without rendering a denied foreign identifier", async () => {
    const deniedId = "foreign-document-type-secret";
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => [{
        ...invoiceInstance,
        compliance_document_type_id: deniedId,
        document_type: {
          ...invoiceInstance.document_type,
          compliance_document_type_id: null,
          status: "denied",
          code: null,
          canonical_name: null,
          category: null,
          lifecycle_status: null,
          status_summary: "Document type access is restricted.",
        },
      }],
    }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps({ canManage: false })} />);

    expect(await screen.findByText("Restricted document type")).toBeInTheDocument();
    expect(screen.getByText("Document type access is restricted.")).toBeInTheDocument();
    expect(screen.queryByText(deniedId)).not.toBeInTheDocument();
  });

  it("expires the active session on an unauthorized owner read", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => (
      String(input).endsWith("/document-instances")
        ? new Response(JSON.stringify({ detail: "expired" }), { status: 401 })
        : new Response(JSON.stringify([]), { status: 200 })
    )));
    render(
      <ShipmentDocumentInstancesPanel
        {...instancePanelProps({ onUnauthorized, canManage: false })}
      />,
    );

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
    expect(await screen.findByText("expired")).toBeInTheDocument();
    expect(screen.getByText("No document instances")).toBeInTheDocument();
  });

  it("expires the active session on an unauthorized mutation", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("crypto", { randomUUID: () => "66666666-6666-4666-8666-666666666666" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/commands") return jsonResponse({ detail: "expired" }, 401);
      if (path.endsWith("/document-instances")) return jsonResponse([invoiceInstance]);
      if (path.endsWith("/document-requirements")) return jsonResponse(requirementResponse([]));
      if (path.endsWith("/document-type-options")) return jsonResponse([invoiceType]);
      return jsonResponse({ detail: "not found" }, 404);
    }));
    render(
      <ShipmentDocumentInstancesPanel
        {...instancePanelProps({ onUnauthorized })}
      />,
    );
    await screen.findByText("INV-2026-0042");
    fireEvent.click(screen.getByRole("button", {
      name: "Change status for COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", {
      name: "Change document instance status form",
    });
    fireEvent.change(within(form).getByLabelText("New instance status"), {
      target: { value: "superseded" },
    });
    fireEvent.change(within(form).getByLabelText("Transition reason"), {
      target: { value: "Replacement record expected" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Change status" }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("expired").length).toBeGreaterThan(0);
  });
});
