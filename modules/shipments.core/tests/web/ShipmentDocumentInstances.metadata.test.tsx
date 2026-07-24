import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentInstancesPanel } from "../../web/src/ShipmentDocumentInstancesPanel";
import type { ShipmentDocumentInstance } from "../../web/src/shipmentDocumentInstanceTypes";
import {
  instanceFetchMock,
  instancePanelProps,
  instanceShipmentId,
  invoiceInstance,
  invoiceRequirement,
  invoiceType,
} from "./ShipmentDocumentInstances.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document instance metadata mutations", () => {
  it("creates metadata with an immutable owner-local requirement link", async () => {
    let current: ShipmentDocumentInstance[] = [];
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => current,
      command: (body) => {
        commands.push(body);
        current = [invoiceInstance];
        return invoiceInstance;
      },
    }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps()} />);
    await screen.findByText("No document instances");

    fireEvent.click(screen.getByRole("button", { name: "Add document metadata" }));
    const form = screen.getByRole("form", { name: "Create document instance form" });
    fireEvent.change(within(form).getByLabelText("Requirement link (optional)"), {
      target: { value: invoiceRequirement.id },
    });
    expect(within(form).getByLabelText("Compliance document type"))
      .toHaveValue(invoiceType.compliance_document_type_id);
    fireEvent.change(within(form).getByLabelText("Document number"), {
      target: { value: " INV-2026-0042 " },
    });
    fireEvent.change(within(form).getByLabelText("Issuing party name (optional)"), {
      target: { value: " Kayilan Export Partner " },
    });
    fireEvent.change(within(form).getByLabelText("Issued on (optional)"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.change(within(form).getByLabelText("Expires on (optional)"), {
      target: { value: "2026-10-10" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Create instance" }));

    expect(await screen.findByText("INV-2026-0042")).toBeInTheDocument();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      command_type: "CreateShipmentDocumentInstance",
      payload: {
        shipment_id: instanceShipmentId,
        compliance_document_type_id: invoiceType.compliance_document_type_id,
        requirement_id: invoiceRequirement.id,
        document_number: "INV-2026-0042",
        issuing_party_name: "Kayilan Export Partner",
        issued_on: "2026-07-10",
        expires_on: "2026-10-10",
      },
    });
  });

  it("updates metadata without resending type or requirement ownership fields", async () => {
    let current = [invoiceInstance];
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => current,
      command: (body) => {
        commands.push(body);
        current = [{ ...invoiceInstance, notes: "Finance reviewed", version: 4 }];
        return current[0];
      },
    }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps()} />);
    await screen.findByText("INV-2026-0042");

    fireEvent.click(screen.getByRole("button", {
      name: "Edit COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", { name: "Edit document instance form" });
    expect(within(form).queryByLabelText("Compliance document type")).not.toBeInTheDocument();
    expect(within(form).queryByLabelText("Requirement link (optional)")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Operational notes (optional)"), {
      target: { value: "Finance reviewed" },
    });
    fireEvent.change(within(form).getByLabelText("Change reason"), {
      target: { value: "Matched invoice to purchase order" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save metadata" }));

    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    expect(screen.getByText("Finance reviewed")).toBeInTheDocument();
    const payload = commands[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      shipment_id: instanceShipmentId,
      instance_id: invoiceInstance.id,
      expected_version: 3,
      notes: "Finance reviewed",
      reason: "Matched invoice to purchase order",
    });
    expect(payload).not.toHaveProperty("compliance_document_type_id");
    expect(payload).not.toHaveProperty("requirement_id");
  });

  it("rejects an expiry date before the issue date in the editor", async () => {
    vi.stubGlobal("fetch", instanceFetchMock({ instances: () => [] }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps()} />);
    await screen.findByText("No document instances");
    fireEvent.click(screen.getByRole("button", { name: "Add document metadata" }));
    const form = screen.getByRole("form", { name: "Create document instance form" });
    fireEvent.change(within(form).getByLabelText("Compliance document type"), {
      target: { value: invoiceType.compliance_document_type_id },
    });
    fireEvent.change(within(form).getByLabelText("Document number"), {
      target: { value: "INV-1" },
    });
    fireEvent.change(within(form).getByLabelText("Issued on (optional)"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(within(form).getByLabelText("Expires on (optional)"), {
      target: { value: "2026-07-19" },
    });

    expect(screen.getByText("Expiry date cannot be before issue date."))
      .toBeInTheDocument();
    expect(form).toHaveAttribute(
      "aria-describedby",
      "shipment-instance-metadata-validation",
    );
    expect(form).toHaveAttribute("aria-invalid", "true");
    expect(within(form).getByRole("button", { name: "Create instance" }))
      .toBeDisabled();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));
  });
});
