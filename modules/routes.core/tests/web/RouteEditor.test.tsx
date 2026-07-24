import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteEditor } from "../../web/src/RouteEditor";
import { destinationOption, locationOptions, originOption, secondWaypointOption, waypointOption } from "./RouteMasterWorkspace.testUtils";

afterEach(cleanup);

describe("Route editor ordered path", () => {
  it("adds, reorders, and removes waypoints without drag-only interaction", () => {
    const onSubmit = vi.fn();
    render(<RouteEditor mode="create" route={null} locationOptions={locationOptions} busy={false} error="" onCancel={vi.fn()} onSubmit={onSubmit} />);
    fillIdentityAndEndpoints();

    fireEvent.click(screen.getByRole("button", { name: "Add waypoint" }));
    fireEvent.change(screen.getByLabelText("Waypoint 1"), { target: { value: waypointOption.location_definition_id } });
    fireEvent.click(screen.getByRole("button", { name: "Add waypoint" }));
    fireEvent.change(screen.getByLabelText("Waypoint 2"), { target: { value: secondWaypointOption.location_definition_id } });
    fireEvent.click(screen.getByRole("button", { name: "Move waypoint 2 up" }));
    expect(screen.getByLabelText("Waypoint 1")).toHaveValue(secondWaypointOption.location_definition_id);
    fireEvent.click(screen.getByRole("button", { name: "Move waypoint 1 down" }));
    expect(screen.getByLabelText("Waypoint 1")).toHaveValue(waypointOption.location_definition_id);
    fireEvent.click(screen.getByRole("button", { name: "Remove waypoint 2" }));

    fireEvent.click(screen.getByRole("button", { name: "Create route" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      originLocationId: originOption.location_definition_id,
      destinationLocationId: destinationOption.location_definition_id,
      waypointLocationIds: [waypointOption.location_definition_id],
    }));
  });

  it("rejects repeated stops and caps paths at eight waypoints", () => {
    render(<RouteEditor mode="create" route={null} locationOptions={locationOptions} busy={false} error="" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    fillIdentityAndEndpoints();
    fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: originOption.location_definition_id } });
    expect(screen.getByText("Each location may appear only once in the ordered route path.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create route" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: destinationOption.location_definition_id } });
    for (let index = 0; index < 8; index += 1) fireEvent.click(screen.getByRole("button", { name: "Add waypoint" }));
    expect(screen.getByRole("button", { name: "Add waypoint" })).toBeDisabled();
  });
});

function fillIdentityAndEndpoints() {
  fireEvent.change(screen.getByLabelText("Route code"), { target: { value: "RCN-NG-NL" } });
  fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "Nigeria Netherlands Corridor" } });
  fireEvent.change(screen.getByLabelText("Origin location"), { target: { value: originOption.location_definition_id } });
  fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: destinationOption.location_definition_id } });
}
