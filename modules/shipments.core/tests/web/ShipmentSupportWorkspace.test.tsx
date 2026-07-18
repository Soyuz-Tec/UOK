import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentSupportWorkspace } from "../../web/src/ShipmentSupportWorkspace";
import type { Shipment } from "../../web/src/types";
import {
  activeShipment,
  closedShipment,
  consigneeParty,
  destinationLocation,
  jsonResponse,
  originLocation,
  routeOption,
  shipmentHistory,
  shipmentHost,
  shipmentModuleRow,
  shipperParty,
} from "./ShipmentSupportWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Shipment Support workspace", () => {
  it("offers installation and signed-out states through the neutral host", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<ShipmentSupportWorkspace host={shipmentHost({
      moduleRows: [{ ...shipmentModuleRow, status: "available", recorded_status: null }],
      moduleAction,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Install Shipment Support" }));
    expect(moduleAction).toHaveBeenCalledWith("shipments.core", "install");

    rerender(<ShipmentSupportWorkspace host={shipmentHost({ token: "" })} />);
    expect(screen.getByText("Sign in to open Shipment Support.")).toBeInTheDocument();
  });

  it("loads Shipment detail, owner values, history, options, search, and filters", async () => {
    const fetchMock = shipmentFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<ShipmentSupportWorkspace host={shipmentHost()} />);

    await screen.findByRole("heading", { name: activeShipment.code });
    expect(screen.getAllByText(shipperParty.display_label!).length).toBeGreaterThan(0);
    expect(await screen.findByText("Draft → Planned")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/shipments/location-options")).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/shipments/route-options")).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === `/api/shipments/records/${activeShipment.id}`)).toBe(true);

    const grid = within(screen.getByRole("grid", { name: "Shipment records" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search Shipments" }), { target: { value: "thoothukudi" } });
    expect(grid.getByText(activeShipment.code)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search Shipments" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Search options: All shipments" }));
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "closed" } });
    expect(grid.getByText(closedShipment.code)).toBeInTheDocument();
    expect(grid.queryByText(activeShipment.code)).not.toBeInTheDocument();
  });

  it("selects the exact Shipment requested by a Planning deep link", async () => {
    window.history.replaceState(
      {},
      "",
      `/?view=shipments&shipment_id=${encodeURIComponent(closedShipment.id)}`,
    );
    const fetchMock = shipmentFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<ShipmentSupportWorkspace host={shipmentHost()} />);

    await screen.findByRole("heading", { name: closedShipment.code });
    expect(fetchMock.mock.calls.some(
      ([input]) => String(input) === `/api/shipments/records/${closedShipment.id}`,
    )).toBe(true);
    expect(screen.getByRole("row", { name: `${closedShipment.code} Closed` })).toHaveAttribute("aria-selected", "true");
  });

  it.each(["finance_manager", "viewer"])("keeps %s role read-only", async (currentUserRole) => {
    vi.stubGlobal("fetch", shipmentFetchMock());
    render(<ShipmentSupportWorkspace host={shipmentHost({ currentUserRole })} />);
    await screen.findByRole("heading", { name: activeShipment.code });
    expect(screen.queryByRole("button", { name: "New shipment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit shipment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Change shipment status" })).not.toBeInTheDocument();
  });

  it("never renders or searches denied Party IDs as fallback labels", async () => {
    const privatePartyId = "party-private-hidden";
    const teamPartyId = "party-team-hidden";
    const deniedShipment: Shipment = {
      ...activeShipment,
      id: "shipment-restricted-parties",
      code: "RCN-RESTRICTED-PARTIES",
      shipper_party_id: privatePartyId,
      consignee_party_id: teamPartyId,
      shipper: {
        status: "denied",
        display_label: null,
        status_summary: "The linked target is not visible to this actor.",
      },
      consignee: {
        status: "denied",
        display_label: null,
        status_summary: "The linked target is not visible to this actor.",
      },
    };
    vi.stubGlobal("fetch", shipmentFetchMock({ current: () => deniedShipment }));
    render(<ShipmentSupportWorkspace host={shipmentHost({ currentUserRole: "viewer" })} />);

    await screen.findByRole("heading", { name: deniedShipment.code });
    expect(screen.getAllByText("Restricted Party").length).toBeGreaterThanOrEqual(4);
    expect(document.body).not.toHaveTextContent(privatePartyId);
    expect(document.body).not.toHaveTextContent(teamPartyId);

    fireEvent.change(screen.getByRole("textbox", { name: "Search Shipments" }), {
      target: { value: privatePartyId },
    });
    expect(within(screen.getByRole("grid", { name: "Shipment records" })).queryByText(
      deniedShipment.code,
    )).not.toBeInTheDocument();
  });

  it("creates a Shipment after resolving both Party IDs through its owner-backed endpoint", async () => {
    const created: Shipment = {
      ...activeShipment,
      id: "shipment-created",
      code: "RCN-AFRICA-VOC-002",
    };
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", shipmentFetchMock({
      command: (body) => {
        commands.push(body);
        return created;
      },
    }));
    render(<ShipmentSupportWorkspace host={shipmentHost()} />);
    await screen.findByRole("heading", { name: activeShipment.code });

    fireEvent.click(screen.getByRole("button", { name: "New shipment" }));
    fireEvent.change(screen.getByLabelText("Shipment code"), { target: { value: " rcn-africa-voc-002 " } });
    fireEvent.change(screen.getByLabelText("Shipper Party ID"), { target: { value: created.shipper_party_id } });
    fireEvent.change(screen.getByLabelText("Consignee Party ID"), { target: { value: created.consignee_party_id } });
    fireEvent.change(screen.getByLabelText("Governed route"), { target: { value: routeOption.route_definition_id } });
    fireEvent.change(screen.getByLabelText("Planned departure"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Planned arrival"), { target: { value: "2026-09-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shipment" }));

    await screen.findByRole("heading", { name: created.code });
    expect(commands[0]).toMatchObject({
      command_type: "CreateShipment",
      payload: {
        code: "rcn-africa-voc-002",
        shipper_party_id: created.shipper_party_id,
        consignee_party_id: created.consignee_party_id,
        origin_location_id: originLocation.location_definition_id,
        destination_location_id: destinationLocation.location_definition_id,
        route_definition_id: routeOption.route_definition_id,
        planned_departure_on: "2026-09-01",
        planned_arrival_on: "2026-09-22",
      },
    });
  });

  it("edits with optimistic version and advances only through a legal, reasoned status transition", async () => {
    let current = activeShipment;
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", shipmentFetchMock({
      current: () => current,
      command: (body) => {
        commands.push(body);
        current = body.command_type === "UpdateShipment"
          ? { ...current, planned_arrival_on: "2026-08-25", version: 2 }
          : { ...current, status: "planned", version: 3 };
        return current;
      },
    }));
    render(<ShipmentSupportWorkspace host={shipmentHost()} />);
    await screen.findByRole("heading", { name: activeShipment.code });

    fireEvent.click(screen.getByRole("button", { name: "Edit shipment" }));
    fireEvent.change(screen.getByLabelText("Planned arrival"), { target: { value: "2026-08-25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shipment" }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(commands[0]).toMatchObject({
      command_type: "UpdateShipment",
      payload: { shipment_id: activeShipment.id, expected_version: 1, planned_arrival_on: "2026-08-25" },
    });
    expect((commands[0].payload as Record<string, unknown>).code).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Next status"), { target: { value: "planned" } });
    fireEvent.change(screen.getByLabelText("Transition reason"), { target: { value: "Export plan approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    await waitFor(() => expect(commands).toHaveLength(2));
    expect(commands[1]).toMatchObject({
      command_type: "TransitionShipmentStatus",
      payload: {
        shipment_id: activeShipment.id,
        expected_version: 2,
        new_status: "planned",
        reason: "Export plan approved",
      },
    });
  });

  it("surfaces owner-reference failures and unauthorized reads", async () => {
    const onUnauthorized = vi.fn();
    const foreignParty = { ...shipperParty, status: "missing" as const, display_label: null, status_summary: "Party is not in this organization." };
    vi.stubGlobal("fetch", shipmentFetchMock({ party: () => foreignParty }));
    render(<ShipmentSupportWorkspace host={shipmentHost({ onUnauthorized })} />);
    await screen.findByRole("heading", { name: activeShipment.code });
    fireEvent.click(screen.getByRole("button", { name: "New shipment" }));
    fillMinimalCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Create shipment" }));
    expect((await screen.findAllByText("Shipper Party: Party is not in this organization.")).length).toBeGreaterThan(0);

    cleanup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "expired" }, 401)));
    render(<ShipmentSupportWorkspace host={shipmentHost({ onUnauthorized })} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});

function fillMinimalCreateForm() {
  fireEvent.change(screen.getByLabelText("Shipment code"), { target: { value: "RCN-AFRICA-VOC-002" } });
  fireEvent.change(screen.getByLabelText("Shipper Party ID"), { target: { value: activeShipment.shipper_party_id } });
  fireEvent.change(screen.getByLabelText("Consignee Party ID"), { target: { value: activeShipment.consignee_party_id } });
  fireEvent.change(screen.getByLabelText("Origin location"), { target: { value: originLocation.location_definition_id } });
  fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: destinationLocation.location_definition_id } });
}

function shipmentFetchMock(options: {
  current?: () => Shipment;
  command?: (body: Record<string, unknown>) => Shipment;
  party?: (partyId: string) => unknown;
} = {}) {
  const current = options.current || (() => activeShipment);
  return vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const path = String(input);
    if (path === "/api/commands") {
      const body = JSON.parse(String(request?.body));
      const result = options.command?.(body) || current();
      return jsonResponse({ result: { ...result, correlation_id: "corr-shipment" } });
    }
    if (path === "/api/shipments/location-options") return jsonResponse([originLocation, destinationLocation]);
    if (path === "/api/shipments/route-options") return jsonResponse([routeOption]);
    if (path.startsWith("/api/shipments/party-references/")) {
      const partyId = decodeURIComponent(path.split("/").at(-1)!);
      return jsonResponse(options.party?.(partyId) || (partyId === activeShipment.shipper_party_id ? shipperParty : consigneeParty));
    }
    if (path === "/api/shipments/document-type-options") return jsonResponse([]);
    if (path.endsWith("/document-requirements")) {
      return jsonResponse({
        items: [],
        summary: {
          required_total: 0,
          required_satisfied: 0,
          required_missing: 0,
          required_received: 0,
          required_waived: 0,
          required_not_applicable: 0,
          optional_total: 0,
        },
      });
    }
    if (path.endsWith("/status-history")) return jsonResponse(shipmentHistory);
    if (path === "/api/shipments/records") return jsonResponse([current(), closedShipment]);
    if (path.startsWith("/api/shipments/records/")) {
      const shipmentId = decodeURIComponent(path.split("/").at(-1)!);
      return jsonResponse(shipmentId === closedShipment.id ? closedShipment : current());
    }
    return jsonResponse({ detail: "not found" }, 404);
  });
}
