import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentRequirementsPanel } from "../../web/src/ShipmentDocumentRequirementsPanel";
import type { ShipmentDocumentRequirement } from "../../web/src/shipmentDocumentRequirementTypes";
import {
  billOfLadingRequirement,
  requirementFetchMock,
  requirementList,
  requirementPanelProps,
} from "./ShipmentDocumentRequirements.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document requirements reads", () => {
  it("renders owner summary and resolved values through Shipment endpoints only", async () => {
    const restrictedId = "never-render-this-type-id";
    const restricted: ShipmentDocumentRequirement = {
      ...billOfLadingRequirement,
      id: "requirement-restricted",
      compliance_document_type_id: null,
      requirement_level: "optional",
      notes: null,
      document_type: {
        compliance_document_type_id: null,
        status: "denied",
        code: null,
        canonical_name: null,
        category: null,
        lifecycle_status: null,
        status_summary: "The document type is not visible to this actor.",
      },
    };
    const fetchMock = requirementFetchMock({
      current: () => requirementList([billOfLadingRequirement, restricted]),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ShipmentDocumentRequirementsPanel {...requirementPanelProps({
      canManage: false,
    })} />);

    expect(await screen.findByText("BILL-OF-LADING · Bill of Lading")).toBeInTheDocument();
    expect(screen.getByText("1 required · 0 received · 0 waived · 1 missing"))
      .toBeInTheDocument();
    expect(screen.getByText("Restricted document type")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(restrictedId);
    expect(screen.queryByRole("button", { name: "Add requirement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload|file/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([input]) => (
      String(input).startsWith("/api/shipments/")
    ))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => (
      String(input).startsWith("/api/compliance")
    ))).toBe(false);
  });

  it("fails closed on unauthorized reads", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => (
      new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )));

    render(<ShipmentDocumentRequirementsPanel {...requirementPanelProps({
      onUnauthorized,
    })} />);

    expect(await screen.findByText("expired")).toBeInTheDocument();
    expect(onUnauthorized).toHaveBeenCalled();
    expect(screen.getByText("No document requirements")).toBeInTheDocument();
  });
});
