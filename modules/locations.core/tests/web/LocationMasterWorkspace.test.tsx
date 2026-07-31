import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationMasterWorkspace } from "../../web/src/LocationMasterWorkspace";
import type { LocationDefinition } from "../../web/src/types";
import {
  activeLocation,
  archivedLocation,
  jsonResponse,
  locationHost,
  locationModuleRow,
  nameHistory,
  warehouseLocation,
} from "./LocationMasterWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Location Master workspace", () => {
  it("offers module installation without importing shell behavior", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    render(<LocationMasterWorkspace host={locationHost({
      moduleRows: [{ ...locationModuleRow, status: "available", recorded_status: null }],
      moduleAction,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Install Location Master" }));
    expect(moduleAction).toHaveBeenCalledWith("locations.core", "install");
  });

  it("loads, searches, filters, and sorts owner-visible location definitions", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("name-history")
      ? Promise.resolve(jsonResponse([]))
      : Promise.resolve(jsonResponse([warehouseLocation, archivedLocation, activeLocation]))));
    const { container } = render(<LocationMasterWorkspace host={locationHost()} />);

    await screen.findAllByText("SGSIN");
    const grid = within(screen.getByRole("grid", { name: "Location definitions" }));
    expect(grid.queryByText("OLD-PORT")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search location definitions" }), { target: { value: "warehouse" } });
    expect(grid.getByText("NLRTM-WH1")).toBeInTheDocument();
    expect(grid.queryByText("SGSIN")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search location definitions" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Search options: Active locations" }));
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "archived" } });
    expect(grid.getByText("OLD-PORT")).toBeInTheDocument();
    expect(grid.queryByText("SGSIN")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Location sort field"), { target: { value: "name" } });
    expect(container.querySelector(".search-workspace-panel")).toBeInTheDocument();
  });

  it.each(["finance_manager", "viewer"])("keeps %s role read-only", async (currentUserRole) => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("name-history")
      ? Promise.resolve(jsonResponse(nameHistory))
      : Promise.resolve(jsonResponse([activeLocation]))));
    render(<LocationMasterWorkspace host={locationHost({ currentUserRole })} />);

    await screen.findAllByText("SGSIN");
    expect(screen.getByRole("heading", { name: "Port of Singapore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New location" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit location" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive location" })).not.toBeInTheDocument();
  });

  it("creates a canonical location through the command bus", async () => {
    const created: LocationDefinition = {
      ...activeLocation,
      id: "location-created",
      code: "USNYC",
      canonical_name: "New York City",
      location_type: "city",
      country_code: "US",
      version: 1,
    };
    const commandBodies: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path === "/api/commands") {
        commandBodies.push(JSON.parse(String(options?.body)));
        return jsonResponse({ result: { ...created, correlation_id: "corr-create" } });
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse([activeLocation]);
    }));
    render(<LocationMasterWorkspace host={locationHost()} />);
    await screen.findAllByText("SGSIN");

    fireEvent.click(screen.getByRole("button", { name: "New location" }));
    expect(screen.getByRole("button", { name: "Create location" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Location code"), { target: { value: " usnyc " } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "New York City" } });
    fireEvent.change(screen.getByLabelText("Location type"), { target: { value: "city" } });
    fireEvent.change(screen.getByLabelText("Country code"), { target: { value: "us" } });
    fireEvent.click(screen.getByRole("button", { name: "Create location" }));

    await screen.findByRole("heading", { name: "New York City" });
    expect(commandBodies[0]).toMatchObject({
      command_type: "CreateLocationDefinition",
      payload: { code: "usnyc", canonical_name: "New York City", location_type: "city", country_code: "US" },
    });
  });

  it("edits with the current version and reloads canonical name history", async () => {
    let updated = false;
    const commandBodies: Record<string, unknown>[] = [];
    const renamed: LocationDefinition = { ...activeLocation, canonical_name: "Singapore Port", location_type: "region", version: 4 };
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path === "/api/commands") {
        commandBodies.push(JSON.parse(String(options?.body)));
        updated = true;
        return jsonResponse({ result: { ...renamed, correlation_id: "corr-update" } });
      }
      if (path.includes("name-history")) return jsonResponse(updated ? [{
        ...nameHistory[0], id: "history-2", previous_name: "Port of Singapore", new_name: "Singapore Port", reason: "Operations standard",
      }, ...nameHistory] : nameHistory);
      return jsonResponse([activeLocation]);
    }));
    render(<LocationMasterWorkspace host={locationHost()} />);
    await screen.findByText("Singapore Harbour → Port of Singapore");

    fireEvent.click(screen.getByRole("button", { name: "Edit location" }));
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "Singapore Port" } });
    fireEvent.change(screen.getByLabelText("Location type"), { target: { value: "region" } });
    fireEvent.change(screen.getByLabelText("Name-change reason"), { target: { value: "Operations standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Save location" }));

    await screen.findByText("Port of Singapore → Singapore Port");
    expect(commandBodies[0]).toMatchObject({
      command_type: "UpdateLocationDefinition",
      payload: { location_definition_id: activeLocation.id, expected_version: 3, canonical_name: "Singapore Port", location_type: "region", country_code: "SG", reason: "Operations standard" },
    });
  });

  it("archives and restores with optimistic versions", async () => {
    let current: LocationDefinition = activeLocation;
    const commands: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path === "/api/commands") {
        const command = JSON.parse(String(options?.body));
        commands.push(command);
        current = command.command_type === "ArchiveLocationDefinition"
          ? { ...current, status: "archived", version: 4, archived_at: "2026-07-16T12:00:00Z" }
          : { ...current, status: "active", version: 5, archived_at: null };
        return jsonResponse({ result: { ...current, correlation_id: `corr-${current.version}` } });
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse([current]);
    }));
    render(<LocationMasterWorkspace host={locationHost()} />);
    await screen.findAllByText("SGSIN");

    await confirmLifecycleAction("Archive location");
    await screen.findByRole("button", { name: "Restore location" });
    fireEvent.click(screen.getByRole("button", { name: "Restore location" }));
    await screen.findByRole("button", { name: "Archive location" });
    expect(commands).toMatchObject([
      { command_type: "ArchiveLocationDefinition", payload: { location_definition_id: activeLocation.id, expected_version: 3 } },
      { command_type: "RestoreLocationDefinition", payload: { location_definition_id: activeLocation.id, expected_version: 4 } },
    ]);
  });

  it("reports permission and unauthorized read failures", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "locations.read required" }, 403));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<LocationMasterWorkspace host={locationHost({
      session: { onUnauthorized },
    })} />);
    await screen.findByText("locations.read required");

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401));
    rerender(<LocationMasterWorkspace host={locationHost({
      session: { onUnauthorized },
      moduleRefreshRevision: 1,
    })} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("reloads owner reads when the neutral module refresh revision changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => String(input).includes("name-history")
      ? Promise.resolve(jsonResponse([]))
      : Promise.resolve(jsonResponse([activeLocation])));
    vi.stubGlobal("fetch", fetchMock);
    const host = locationHost();
    const { rerender } = render(<LocationMasterWorkspace host={host} />);
    await screen.findAllByText("SGSIN");
    const listCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes("include_archived=true")).length;
    const before = listCalls();

    rerender(<LocationMasterWorkspace host={{ ...host, moduleRefreshRevision: 1 }} />);
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });
});

async function confirmLifecycleAction(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  const confirmation = await screen.findByRole("alertdialog", { name: "Confirm action" });
  fireEvent.click(within(confirmation).getByRole("button", { name }));
}
