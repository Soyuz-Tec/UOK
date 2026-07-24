import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentEditor } from "../../web/src/ShipmentEditor";
import {
  activeShipment,
  destinationLocation,
  originLocation,
  routeOption,
} from "./ShipmentSupportWorkspace.testUtils";

afterEach(cleanup);

describe("Shipment editor", () => {
  it("applies governed Route endpoints and rejects reversed dates", () => {
    const onSubmit = vi.fn();
    render(
      <ShipmentEditor
        mode="create"
        shipment={null}
        locationOptions={[originLocation, destinationLocation]}
        routeOptions={[routeOption]}
        busy={false}
        error=""
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Governed route"), { target: { value: routeOption.route_definition_id } });
    expect(screen.getByLabelText("Origin location")).toHaveValue(originLocation.location_definition_id);
    expect(screen.getByLabelText("Destination location")).toHaveValue(destinationLocation.location_definition_id);
    fireEvent.change(screen.getByLabelText("Planned departure"), { target: { value: "2026-08-10" } });
    fireEvent.change(screen.getByLabelText("Planned arrival"), { target: { value: "2026-08-09" } });
    expect(screen.getByText("Planned arrival cannot be earlier than planned departure.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create shipment" })).toBeDisabled();
  });

  it("prevents mismatched or repeated endpoints and submits a valid owner-reference draft", () => {
    const onSubmit = vi.fn();
    render(
      <ShipmentEditor
        mode="create"
        shipment={null}
        locationOptions={[originLocation, destinationLocation]}
        routeOptions={[routeOption]}
        busy={false}
        error=""
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fillIdentity();
    fireEvent.change(screen.getByLabelText("Origin location"), { target: { value: originLocation.location_definition_id } });
    fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: originLocation.location_definition_id } });
    expect(screen.getByText("Origin and destination must be different Locations.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: destinationLocation.location_definition_id } });
    fireEvent.click(screen.getByRole("button", { name: "Create shipment" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      shipperPartyId: activeShipment.shipper_party_id,
      consigneePartyId: activeShipment.consignee_party_id,
      originLocationId: originLocation.location_definition_id,
      destinationLocationId: destinationLocation.location_definition_id,
    }));
  });
});

function fillIdentity() {
  fireEvent.change(screen.getByLabelText("Shipment code"), { target: { value: activeShipment.code } });
  fireEvent.change(screen.getByLabelText("Shipper Party ID"), { target: { value: activeShipment.shipper_party_id } });
  fireEvent.change(screen.getByLabelText("Consignee Party ID"), { target: { value: activeShipment.consignee_party_id } });
}
