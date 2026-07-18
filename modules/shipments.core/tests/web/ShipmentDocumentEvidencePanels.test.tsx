import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentEvidencePanels } from "../../web/src/ShipmentDocumentEvidencePanels";
import type { ShipmentDocumentRequirement } from "../../web/src/shipmentDocumentRequirementTypes";
import type { ShipmentDocumentInstance } from "../../web/src/shipmentDocumentInstanceTypes";
import {
  instanceFetchMock,
  invoiceInstance,
  invoiceRequirement,
  requirementResponse,
} from "./ShipmentDocumentInstances.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document evidence coherence", () => {
  it("reloads instance requirement snapshots after a requirement status change", async () => {
    let requirements = [invoiceRequirement];
    let instances = [invoiceInstance];
    vi.stubGlobal("crypto", {
      randomUUID: () => "55555555-5555-4555-8555-555555555555",
    });
    vi.stubGlobal("fetch", instanceFetchMock({
      instances: () => instances,
      requirements: () => requirementResponse(requirements),
      command: () => {
        const received = {
          ...invoiceRequirement,
          status: "received",
          version: 5,
        } as ShipmentDocumentRequirement;
        requirements = [received];
        instances = [{
          ...invoiceInstance,
          requirement: {
            ...invoiceInstance.requirement!,
            status: "received",
            version: 5,
          },
        } as ShipmentDocumentInstance];
        return received;
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
    await screen.findByText("required · missing");

    fireEvent.click(screen.getByRole("button", {
      name: "Set status for COMMERCIAL-INVOICE · Commercial Invoice",
    }));
    const form = screen.getByRole("form", { name: "Update status form" });
    fireEvent.change(within(form).getByLabelText("New satisfaction status"), {
      target: { value: "received" },
    });
    fireEvent.change(within(form).getByLabelText("Change reason"), {
      target: { value: "Original received outside the instance workflow" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Update status" }));

    await waitFor(() => expect(document.querySelector(".workspace-popup-backdrop")).toBeNull());
    expect(await screen.findByText("required · received")).toBeInTheDocument();
    expect(screen.getByText("1 required · 1 received · 0 waived · 0 missing"))
      .toBeInTheDocument();
  });
});
