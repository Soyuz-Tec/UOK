import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteMasterWorkspace } from "../../web/src/RouteMasterWorkspace";
import type { RouteDefinition } from "../../web/src/types";
import {
  activeRoute,
  archivedRoute,
  destinationOption,
  jsonResponse,
  locationOptions,
  originOption,
  routeHistory,
  routeHost,
  routeModuleRow,
  waypointOption,
} from "./RouteMasterWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Route/Corridor Master workspace", () => {
  it("offers installation and signed-out states through the neutral host", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<RouteMasterWorkspace host={routeHost({
      moduleRows: [{ ...routeModuleRow, status: "available", recorded_status: null }],
      moduleAction,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Install Route/Corridor Master" }));
    expect(moduleAction).toHaveBeenCalledWith("routes.core", "install");

    rerender(<RouteMasterWorkspace host={routeHost({ token: "" })} />);
    expect(screen.getByText("Sign in to open Route/Corridor Master.")).toBeInTheDocument();
  });

  it("loads owner routes, detail, history, location options, search, and filters", async () => {
    const fetchMock = routeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<RouteMasterWorkspace host={routeHost()} />);

    await screen.findByText("Nigeria Netherlands Lane → Nigeria to Netherlands RCN Corridor");
    const grid = within(screen.getByRole("grid", { name: "Route definitions" }));
    expect(grid.queryByText("OLD-SEA-LANE")).not.toBeInTheDocument();
    expect(screen.getByText("NG-APAPA · Apapa Port")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/routes/location-options")).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === `/api/routes/definitions/${activeRoute.id}`)).toBe(true);

    fireEvent.change(screen.getByRole("textbox", { name: "Search Route Definitions" }), { target: { value: "rotterdam" } });
    expect(grid.getByText("RCN-NG-NL")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search Route Definitions" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Search options: Active routes" }));
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "archived" } });
    expect(grid.getByText("OLD-SEA-LANE")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mode filter"), { target: { value: "sea" } });
    fireEvent.change(screen.getByLabelText("Route sort field"), { target: { value: "name" } });
    expect(container.querySelector(".search-workspace-panel")).toBeInTheDocument();
  });

  it.each(["finance_manager", "viewer"])("keeps %s role read-only", async (currentUserRole) => {
    vi.stubGlobal("fetch", routeFetchMock());
    render(<RouteMasterWorkspace host={routeHost({ currentUserRole })} />);
    await screen.findByRole("heading", { name: activeRoute.canonical_name });
    expect(screen.queryByRole("button", { name: "New route" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit route" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive route" })).not.toBeInTheDocument();
  });

  it("creates a route with a complete ordered path", async () => {
    const created: RouteDefinition = {
      ...activeRoute,
      id: "route-created",
      code: "SEA-NG-NL",
      canonical_name: "Apapa Rotterdam Sea Lane",
      mode_hint: "sea",
      version: 1,
      stops: [
        { sequence: 0, stop_role: "origin", location: originOption },
        { sequence: 1, stop_role: "destination", location: destinationOption },
      ],
    };
    let current = activeRoute;
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", routeFetchMock({
      current: () => current,
      command: (body) => {
        commands.push(body);
        current = created;
        return created;
      },
    }));
    render(<RouteMasterWorkspace host={routeHost()} />);
    await screen.findByRole("heading", { name: activeRoute.canonical_name });

    fireEvent.click(screen.getByRole("button", { name: "New route" }));
    fireEvent.change(screen.getByLabelText("Route code"), { target: { value: " sea-ng-nl " } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: created.canonical_name } });
    fireEvent.change(screen.getByLabelText("Mode hint"), { target: { value: "sea" } });
    fireEvent.change(screen.getByLabelText("Origin location"), { target: { value: originOption.location_definition_id } });
    fireEvent.change(screen.getByLabelText("Destination location"), { target: { value: destinationOption.location_definition_id } });
    fireEvent.click(screen.getByRole("button", { name: "Create route" }));

    await screen.findByRole("heading", { name: created.canonical_name });
    expect(commands[0]).toMatchObject({
      command_type: "CreateRouteDefinition",
      payload: {
        code: "sea-ng-nl", canonical_name: created.canonical_name, mode_hint: "sea",
        origin_location_id: originOption.location_definition_id,
        destination_location_id: destinationOption.location_definition_id,
        waypoint_location_ids: [],
      },
    });
  });

  it("edits with optimistic version, full path, and refreshed history", async () => {
    let current = activeRoute;
    let updated = false;
    const commands: Record<string, unknown>[] = [];
    const renamed: RouteDefinition = { ...activeRoute, canonical_name: "Governed RCN Corridor", mode_hint: "sea", version: 4 };
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", routeFetchMock({
      current: () => current,
      history: () => updated ? [{
        ...routeHistory[0], id: "history-2", previous_name: activeRoute.canonical_name,
        new_name: renamed.canonical_name, reason: "Operations standard",
      }, ...routeHistory] : routeHistory,
      command: (body) => {
        commands.push(body);
        updated = true;
        current = renamed;
        return renamed;
      },
    }));
    render(<RouteMasterWorkspace host={routeHost()} />);
    await screen.findByText("Nigeria Netherlands Lane → Nigeria to Netherlands RCN Corridor");

    fireEvent.click(screen.getByRole("button", { name: "Edit route" }));
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: renamed.canonical_name } });
    fireEvent.change(screen.getByLabelText("Mode hint"), { target: { value: "sea" } });
    fireEvent.change(screen.getByLabelText("Name-change reason"), { target: { value: "Operations standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Save route" }));

    await screen.findByText(`${activeRoute.canonical_name} → ${renamed.canonical_name}`);
    expect(commands[0]).toMatchObject({
      command_type: "UpdateRouteDefinition",
      payload: {
        route_definition_id: activeRoute.id, expected_version: 3,
        origin_location_id: originOption.location_definition_id,
        destination_location_id: destinationOption.location_definition_id,
        waypoint_location_ids: [waypointOption.location_definition_id],
      },
    });
  });

  it("archives and restores with optimistic versions", async () => {
    let current: RouteDefinition = activeRoute;
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    vi.stubGlobal("fetch", routeFetchMock({
      current: () => current,
      command: (body) => {
        commands.push(body);
        current = body.command_type === "ArchiveRouteDefinition"
          ? { ...current, status: "archived", version: 4, archived_at: "2026-07-16T12:00:00Z" }
          : { ...current, status: "active", version: 5, archived_at: null };
        return current;
      },
    }));
    render(<RouteMasterWorkspace host={routeHost()} />);
    await screen.findByRole("button", { name: "Archive route" });
    await confirmLifecycleAction("Archive route");
    await screen.findByRole("button", { name: "Restore route" });
    fireEvent.click(screen.getByRole("button", { name: "Restore route" }));
    await screen.findByRole("button", { name: "Archive route" });
    expect(commands).toMatchObject([
      { command_type: "ArchiveRouteDefinition", payload: { route_definition_id: activeRoute.id, expected_version: 3 } },
      { command_type: "RestoreRouteDefinition", payload: { route_definition_id: activeRoute.id, expected_version: 4 } },
    ]);
  });

  it("reports read errors, unauthorized responses, and refresh revisions", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ detail: "routes.read required" }, 403)));
    vi.stubGlobal("fetch", fetchMock);
    const host = routeHost({ onUnauthorized });
    const { rerender } = render(<RouteMasterWorkspace host={host} />);
    await screen.findByText("routes.read required");

    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ detail: "expired" }, 401)));
    rerender(<RouteMasterWorkspace host={{ ...host, moduleRefreshRevision: 1 }} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());

    const successfulFetch = routeFetchMock();
    vi.stubGlobal("fetch", successfulFetch);
    rerender(<RouteMasterWorkspace host={{ ...host, moduleRefreshRevision: 2 }} />);
    await screen.findByRole("heading", { name: activeRoute.canonical_name });
    const before = successfulFetch.mock.calls.filter(([input]) => String(input).includes("include_archived=true")).length;
    rerender(<RouteMasterWorkspace host={{ ...host, moduleRefreshRevision: 3 }} />);
    await waitFor(() => expect(successfulFetch.mock.calls.filter(([input]) => String(input).includes("include_archived=true")).length).toBeGreaterThan(before));
  });
});

async function confirmLifecycleAction(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  const confirmation = await screen.findByRole("dialog", { name: "Confirm action" });
  fireEvent.click(within(confirmation).getByRole("button", { name }));
}

function routeFetchMock(options: {
  current?: () => RouteDefinition;
  history?: () => unknown[];
  command?: (body: Record<string, unknown>) => RouteDefinition;
} = {}) {
  const current = options.current || (() => activeRoute);
  return vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const path = String(input);
    if (path === "/api/commands") {
      const body = JSON.parse(String(request?.body));
      const result = options.command?.(body) || current();
      return jsonResponse({ result: { ...result, correlation_id: "corr-route" } });
    }
    if (path === "/api/routes/location-options") return jsonResponse(locationOptions);
    if (path.includes("name-history")) return jsonResponse(options.history?.() || routeHistory);
    if (path.includes("include_archived=true")) return jsonResponse([current(), archivedRoute]);
    if (path.startsWith("/api/routes/definitions/")) return jsonResponse(current());
    return jsonResponse({ detail: "not found" }, 404);
  });
}
