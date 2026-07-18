import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentEvidencePanels } from "../../web/src/ShipmentDocumentEvidencePanels";
import { ShipmentDocumentInstancesPanel } from "../../web/src/ShipmentDocumentInstancesPanel";
import type { ShipmentDocumentRequirement } from "../../web/src/shipmentDocumentRequirementTypes";
import type { ShipmentDocumentInstance } from "../../web/src/shipmentDocumentInstanceTypes";
import {
  instanceFetchMock,
  instancePanelProps,
  invoiceInstance,
  invoiceRequirement,
  requirementResponse,
} from "./ShipmentDocumentInstances.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document instance lifecycle", () => {
  it("explicitly verifies metadata and atomically marks a missing link received", async () => {
    let instances = [invoiceInstance];
    let requirements = [invoiceRequirement];
    const commands: Record<string, unknown>[] = [];
    const onRequirementChanged = vi.fn();
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => instances,
      requirements: () => requirementResponse(requirements),
      command: (body) => {
        commands.push(body);
        requirements = [{
          ...invoiceRequirement,
          status: "received",
          version: 5,
        } as ShipmentDocumentRequirement];
        instances = [{
          ...invoiceInstance,
          status: "verified",
          version: 4,
          requirement: {
            ...invoiceInstance.requirement!,
            status: "received",
            version: 5,
          },
        } as ShipmentDocumentInstance];
        return instances[0];
      },
    }));
    render(
      <ShipmentDocumentInstancesPanel
        {...instancePanelProps({ onRequirementChanged })}
      />,
    );
    await screen.findByText("INV-2026-0042");

    fireEvent.click(screen.getByRole("button", {
      name: "Change status for COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", {
      name: "Change document instance status form",
    });
    expect(form).toHaveAttribute("aria-describedby", "shipment-instance-status-validation");
    expect(form).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(within(form).getByLabelText("New instance status"), {
      target: { value: "verified" },
    });
    const receive = within(form).getByLabelText("Mark linked requirement received");
    expect(receive).not.toBeChecked();
    fireEvent.click(receive);
    fireEvent.change(within(form).getByLabelText("Transition reason"), {
      target: { value: "Operations verified the original" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Change status" }));

    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(commands[0]).toMatchObject({
      command_type: "SetShipmentDocumentInstanceStatus",
      payload: {
        shipment_id: invoiceInstance.shipment_id,
        instance_id: invoiceInstance.id,
        expected_version: 3,
        new_status: "verified",
        reason: "Operations verified the original",
        mark_requirement_received: true,
        expected_requirement_version: 4,
      },
    });
    expect(onRequirementChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps readiness coherent by reloading both owner panels after coupled verify", async () => {
    let instances = [invoiceInstance];
    let requirements = [invoiceRequirement];
    vi.stubGlobal("crypto", { randomUUID: () => "44444444-4444-4444-8444-444444444444" });
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => instances,
      requirements: () => requirementResponse(requirements),
      command: () => {
        requirements = [{ ...invoiceRequirement, status: "received", version: 5 }];
        instances = [{
          ...invoiceInstance,
          status: "verified",
          version: 4,
          requirement: {
            ...invoiceInstance.requirement!,
            status: "received",
            version: 5,
          },
        }];
        return instances[0];
      },
    }));
    render(
      <ShipmentDocumentEvidencePanels
        token="tenant-token"
        shipmentId={invoiceInstance.shipment_id}
        canManage
        onUnauthorized={vi.fn()}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByText("1 required · 0 received · 0 waived · 1 missing"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {
      name: "Change status for COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", {
      name: "Change document instance status form",
    });
    fireEvent.change(within(form).getByLabelText("New instance status"), {
      target: { value: "verified" },
    });
    fireEvent.click(within(form).getByLabelText("Mark linked requirement received"));
    fireEvent.change(within(form).getByLabelText("Transition reason"), {
      target: { value: "Verified against the trade record" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Change status" }));

    expect(await screen.findByText("1 required · 1 received · 0 waived · 0 missing"))
      .toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("required · received")).toBeInTheDocument());
  });

  it("does not offer readiness coupling for an unlinked instance", async () => {
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => [{ ...invoiceInstance, requirement_id: null, requirement: null }],
    }));
    render(<ShipmentDocumentInstancesPanel {...instancePanelProps()} />);
    await screen.findByText("INV-2026-0042");
    fireEvent.click(screen.getByRole("button", {
      name: "Change status for COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", {
      name: "Change document instance status form",
    });
    fireEvent.change(within(form).getByLabelText("New instance status"), {
      target: { value: "verified" },
    });
    expect(within(form).queryByLabelText("Mark linked requirement received"))
      .not.toBeInTheDocument();
  });
});
