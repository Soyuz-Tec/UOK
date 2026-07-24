import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentRequirementsPanel } from "../../web/src/ShipmentDocumentRequirementsPanel";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementList,
} from "../../web/src/shipmentDocumentRequirementTypes";
import {
  billOfLadingRequirement,
  billOfLadingType,
  requirementFetchMock,
  requirementList,
  requirementPanelProps,
  shipmentId,
} from "./ShipmentDocumentRequirements.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document requirement mutations", () => {
  it("adds an active Compliance type through the Shipment command surface", async () => {
    let current = requirementList([]);
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", requirementFetchMock({
      current: () => current,
      command: (body) => {
        commands.push(body);
        const payload = body.payload as Record<string, unknown>;
        const added = {
          ...billOfLadingRequirement,
          requirement_level: payload.requirement_level,
          notes: payload.notes,
        } as ShipmentDocumentRequirement;
        current = requirementList([added]);
        return added;
      },
    }));
    render(<ShipmentDocumentRequirementsPanel {...requirementPanelProps()} />);
    await screen.findByText("No document requirements");

    fireEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    const form = screen.getByRole("form", { name: "Add requirement form" });
    fireEvent.change(within(form).getByLabelText("Compliance document type"), {
      target: { value: billOfLadingType.compliance_document_type_id },
    });
    fireEvent.change(within(form).getByLabelText("Operational notes"), {
      target: { value: "Carrier original" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Add requirement" }));

    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    expect(await screen.findByText("Carrier original")).toBeInTheDocument();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      command_type: "AddShipmentDocumentRequirement",
      payload: {
        shipment_id: shipmentId,
        compliance_document_type_id: billOfLadingType.compliance_document_type_id,
        requirement_level: "required",
        notes: "Carrier original",
      },
    });
  });

  it("updates metadata, corrects status, and removes with independent versions", async () => {
    let current: ShipmentDocumentRequirementList = requirementList([
      billOfLadingRequirement,
    ]);
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", requirementFetchMock({
      current: () => current,
      command: (body) => {
        commands.push(body);
        const payload = body.payload as Record<string, unknown>;
        if (body.command_type === "RemoveShipmentDocumentRequirement") {
          current = requirementList([]);
          return { id: billOfLadingRequirement.id, removed: true, version: 4 };
        }
        const existing = current.items[0];
        const changed: ShipmentDocumentRequirement = {
          ...existing,
          requirement_level: (payload.requirement_level || existing.requirement_level) as "required" | "optional",
          notes: "notes" in payload ? payload.notes as string | null : existing.notes,
          status: (payload.new_status || existing.status) as ShipmentDocumentRequirement["status"],
          version: existing.version + 1,
        };
        current = requirementList([changed]);
        return changed;
      },
    }));
    render(<ShipmentDocumentRequirementsPanel {...requirementPanelProps()} />);
    const label = "BILL-OF-LADING · Bill of Lading";
    await screen.findByText(label);

    fireEvent.click(screen.getByRole("button", { name: `Edit ${label}` }));
    const edit = screen.getByRole("form", { name: "Save requirement form" });
    fireEvent.change(within(edit).getByLabelText("Requirement level"), {
      target: { value: "optional" },
    });
    fireEvent.change(within(edit).getByLabelText("Operational notes"), {
      target: { value: "Telex release accepted" },
    });
    fireEvent.change(within(edit).getByLabelText("Change reason"), {
      target: { value: "Operations confirmed release method" },
    });
    fireEvent.click(within(edit).getByRole("button", { name: "Save requirement" }));
    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    await screen.findByText("Telex release accepted");
    expect(screen.getByText("0 required · 0 received · 0 waived · 0 missing"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Set status for ${label}` }));
    const status = screen.getByRole("form", { name: "Update status form" });
    fireEvent.change(within(status).getByLabelText("New satisfaction status"), {
      target: { value: "received" },
    });
    fireEvent.change(within(status).getByLabelText("Change reason"), {
      target: { value: "Original received by operations" },
    });
    fireEvent.click(within(status).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    await screen.findByText("Received");

    fireEvent.click(screen.getByRole("button", { name: `Remove ${label}` }));
    const remove = screen.getByRole("form", { name: "Remove requirement form" });
    fireEvent.change(within(remove).getByLabelText("Removal reason"), {
      target: { value: "Requirement entered in error" },
    });
    fireEvent.click(within(remove).getByRole("button", { name: "Remove requirement" }));
    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    await screen.findByText("No document requirements");

    expect(commands.map((command) => command.command_type)).toEqual([
      "UpdateShipmentDocumentRequirement",
      "SetShipmentDocumentRequirementStatus",
      "RemoveShipmentDocumentRequirement",
    ]);
    expect(commands[0]).toMatchObject({
      payload: {
        shipment_id: shipmentId,
        requirement_id: billOfLadingRequirement.id,
        expected_version: 1,
        requirement_level: "optional",
        notes: "Telex release accepted",
        reason: "Operations confirmed release method",
      },
    });
    expect(commands[1]).toMatchObject({
      payload: {
        expected_version: 2,
        new_status: "received",
        reason: "Original received by operations",
      },
    });
    expect(commands[2]).toMatchObject({
      payload: {
        expected_version: 3,
        reason: "Requirement entered in error",
      },
    });
    await waitFor(() => expect(current.items).toHaveLength(0));
  });
});
