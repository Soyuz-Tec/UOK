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

describe("Shipment document requirements keyed unmount guards", () => {
  it("does not expire the new session when an unmounted read returns 401", async () => {
    const staleRead = deferred<Response>();
    const onUnauthorized = vi.fn();
    const tenantB = tenantBRequirement();
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path.endsWith("/document-type-options")) return jsonResponse([billOfLadingType]);
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? staleRead.promise
        : jsonResponse(requirementList([tenantB]));
    }));
    const { rerender } = render(
      <ShipmentDocumentRequirementsPanel
        key="tenant-a:shipment-a:ops"
        {...requirementPanelProps({
          token: "tenant-a",
          shipmentId: "shipment-a",
          onUnauthorized,
        })}
      />,
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));

    rerender(
      <ShipmentDocumentRequirementsPanel
        key="tenant-b:shipment-b:viewer"
        {...requirementPanelProps({
          token: "tenant-b",
          shipmentId: "shipment-b",
          canManage: false,
          onUnauthorized,
        })}
      />,
    );
    expect(await screen.findByText("PACKING-LIST · Tenant B Packing List"))
      .toBeInTheDocument();
    await act(async () => staleRead.resolve(jsonResponse({ detail: "stale" }, 401)));

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(screen.getByText("PACKING-LIST · Tenant B Packing List"))
      .toBeInTheDocument();
  });

  it("discards an unmounted mutation 401 without status or auth side effects", async () => {
    const staleCommand = deferred<Response>();
    const onUnauthorized = vi.fn();
    const onStatus = vi.fn();
    const tenantB = tenantBRequirement();
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path === "/api/commands") return staleCommand.promise;
      if (path.endsWith("/document-type-options")) return jsonResponse([billOfLadingType]);
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? jsonResponse(requirementList([billOfLadingRequirement]))
        : jsonResponse(requirementList([tenantB]));
    }));
    const { rerender } = render(
      <ShipmentDocumentRequirementsPanel
        key="tenant-a:shipment-a:ops"
        {...requirementPanelProps({
          token: "tenant-a",
          shipmentId: "shipment-a",
          onUnauthorized,
          onStatus,
        })}
      />,
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

    rerender(
      <ShipmentDocumentRequirementsPanel
        key="tenant-b:shipment-b:viewer"
        {...requirementPanelProps({
          token: "tenant-b",
          shipmentId: "shipment-b",
          canManage: false,
          onUnauthorized,
          onStatus,
        })}
      />,
    );
    expect(await screen.findByText("PACKING-LIST · Tenant B Packing List"))
      .toBeInTheDocument();
    await act(async () => staleCommand.resolve(jsonResponse({ detail: "stale" }, 401)));

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(screen.getByText("PACKING-LIST · Tenant B Packing List"))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set status for/ })).not.toBeInTheDocument();
  });
});

function tenantBRequirement(): ShipmentDocumentRequirement {
  return {
    ...billOfLadingRequirement,
    id: "requirement-b",
    shipment_id: "shipment-b",
    status: "waived",
    document_type: {
      ...billOfLadingType,
      compliance_document_type_id: "tenant-b-packing-list",
      code: "PACKING-LIST",
      canonical_name: "Tenant B Packing List",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
