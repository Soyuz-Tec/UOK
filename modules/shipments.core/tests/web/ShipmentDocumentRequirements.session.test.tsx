import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentRequirementsPanel } from "../../web/src/ShipmentDocumentRequirementsPanel";
import type { ShipmentDocumentRequirement } from "../../web/src/shipmentDocumentRequirementTypes";
import {
  billOfLadingRequirement,
  billOfLadingType,
  jsonResponse,
  requirementList,
  requirementPanelProps,
} from "./ShipmentDocumentRequirements.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document requirements session guards", () => {
  it("ignores an old tenant and Shipment read after selection changes", async () => {
    const tenantA = deferred<Response>();
    const tenantBRequirement: ShipmentDocumentRequirement = {
      ...billOfLadingRequirement,
      id: "requirement-tenant-b",
      shipment_id: "shipment-tenant-b",
      document_type: {
        ...billOfLadingType,
        compliance_document_type_id: "tenant-b-invoice",
        code: "COMMERCIAL-INVOICE",
        canonical_name: "Tenant B Commercial Invoice",
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path.endsWith("/document-type-options")) return jsonResponse([billOfLadingType]);
      const authorization = (request?.headers as Record<string, string>).Authorization;
      if (authorization === "Bearer tenant-a") return tenantA.promise;
      return jsonResponse(requirementList([tenantBRequirement]));
    }));
    const { rerender } = render(
      <ShipmentDocumentRequirementsPanel {...requirementPanelProps({
        token: "tenant-a",
        shipmentId: "shipment-tenant-a",
      })} />,
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));

    rerender(<ShipmentDocumentRequirementsPanel {...requirementPanelProps({
      token: "tenant-b",
      shipmentId: "shipment-tenant-b",
    })} />);
    expect(await screen.findByText("COMMERCIAL-INVOICE · Tenant B Commercial Invoice"))
      .toBeInTheDocument();

    await act(async () => tenantA.resolve(
      jsonResponse(requirementList([billOfLadingRequirement])),
    ));
    expect(screen.getByText("COMMERCIAL-INVOICE · Tenant B Commercial Invoice"))
      .toBeInTheDocument();
    expect(screen.queryByText("BILL-OF-LADING · Bill of Lading")).not.toBeInTheDocument();
  });

  it("discards a mutation completion after tenant and role change", async () => {
    const command = deferred<Response>();
    const onStatus = vi.fn();
    const tenantBRequirement: ShipmentDocumentRequirement = {
      ...billOfLadingRequirement,
      id: "requirement-b",
      shipment_id: "shipment-b",
      status: "waived",
      document_type: {
        ...billOfLadingType,
        code: "PACKING-LIST",
        canonical_name: "Tenant B Packing List",
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path === "/api/commands") return command.promise;
      if (path.endsWith("/document-type-options")) return jsonResponse([billOfLadingType]);
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? jsonResponse(requirementList([billOfLadingRequirement]))
        : jsonResponse(requirementList([tenantBRequirement]));
    }));
    const { rerender } = render(
      <ShipmentDocumentRequirementsPanel {...requirementPanelProps({
        token: "tenant-a",
        shipmentId: "shipment-a",
        onStatus,
      })} />,
    );
    const label = "BILL-OF-LADING · Bill of Lading";
    await screen.findByText(label);
    fireEvent.click(screen.getByRole("button", { name: `Set status for ${label}` }));
    const form = screen.getByRole("form", { name: "Update status form" });
    fireEvent.change(within(form).getByLabelText("New satisfaction status"), {
      target: { value: "received" },
    });
    fireEvent.change(within(form).getByLabelText("Change reason"), {
      target: { value: "Original received" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/commands",
      expect.anything(),
    ));

    rerender(<ShipmentDocumentRequirementsPanel {...requirementPanelProps({
      token: "tenant-b",
      shipmentId: "shipment-b",
      canManage: false,
      onStatus,
    })} />);
    expect(await screen.findByText("PACKING-LIST · Tenant B Packing List"))
      .toBeInTheDocument();
    await act(async () => command.resolve(jsonResponse({
      result: { ...billOfLadingRequirement, status: "received" },
    })));

    expect(screen.getByText("PACKING-LIST · Tenant B Packing List")).toBeInTheDocument();
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set status for/ })).not.toBeInTheDocument();
    expect(onStatus).not.toHaveBeenCalledWith(
      "Updated shipment document requirement status.",
    );
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
