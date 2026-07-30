import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductMasterWorkspace } from "../../web/src/ProductMasterWorkspace";
import type { ProductDefinition } from "../../web/src/types";
import {
  activeProduct,
  archivedProduct,
  jsonResponse,
  nameHistory,
  productHost,
  productModuleRow,
  soyProduct,
} from "./ProductMasterWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Product Master workspace", () => {
  it("offers module installation without importing shell behavior", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    render(<ProductMasterWorkspace host={productHost({
      moduleRows: [{ ...productModuleRow, status: "available", recorded_status: null }],
      moduleAction,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Install Product Master" }));
    expect(moduleAction).toHaveBeenCalledWith("product.master", "install");
  });

  it("loads, searches, filters, and sorts owner-visible product definitions", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("name-history")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([soyProduct, archivedProduct, activeProduct]));
    }));
    const { container } = render(<ProductMasterWorkspace host={productHost()} />);

    await screen.findAllByText("RICE-001");
    const grid = within(screen.getByRole("grid", { name: "Product definitions" }));
    expect(grid.queryByText("OLD-001")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search product definitions" }), { target: { value: "soy" } });
    expect(grid.getByText("SOY-001")).toBeInTheDocument();
    expect(grid.queryByText("RICE-001")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search product definitions" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Search options: Active products" }));
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "archived" } });
    expect(grid.getByText("OLD-001")).toBeInTheDocument();
    expect(grid.queryByText("RICE-001")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Product sort field"), { target: { value: "name" } });
    expect(container.querySelector(".search-workspace-panel")).toBeInTheDocument();
  });

  it.each(["finance_manager", "viewer"])("keeps %s role read-only", async (currentUserRole) => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => String(input).includes("name-history")
      ? Promise.resolve(jsonResponse(nameHistory))
      : Promise.resolve(jsonResponse([activeProduct]))));
    render(<ProductMasterWorkspace host={productHost({ currentUserRole })} />);

    await screen.findAllByText("RICE-001");
    expect(screen.getByRole("heading", { name: "Rice" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New product" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit product" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive product" })).not.toBeInTheDocument();
  });

  it("creates a canonical product through the command bus", async () => {
    const created: ProductDefinition = {
      ...activeProduct,
      id: "product-created",
      code: "CORN-001",
      canonical_name: "Yellow Corn",
      base_unit_code: "MT",
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
      return jsonResponse([activeProduct]);
    }));
    render(<ProductMasterWorkspace host={productHost()} />);
    await screen.findAllByText("RICE-001");

    fireEvent.click(screen.getByRole("button", { name: "New product" }));
    expect(screen.getByLabelText("Product code")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Product code"), { target: { value: " corn-001 " } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "Yellow Corn" } });
    fireEvent.change(screen.getByLabelText("Base unit code"), { target: { value: "mt" } });
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    await screen.findByRole("heading", { name: "Yellow Corn" });
    expect(commandBodies[0]).toMatchObject({
      command_type: "CreateProductDefinition",
      payload: { code: "corn-001", canonical_name: "Yellow Corn", base_unit_code: "MT" },
    });
    expect(screen.queryByRole("dialog", { name: "Create product definition" })).not.toBeInTheDocument();
  });

  it("edits with the current version and reloads canonical name history", async () => {
    let updated = false;
    const commandBodies: Record<string, unknown>[] = [];
    const renamed = { ...activeProduct, canonical_name: "Premium Rice", version: 4 };
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path === "/api/commands") {
        commandBodies.push(JSON.parse(String(options?.body)));
        updated = true;
        return jsonResponse({ result: { ...renamed, correlation_id: "corr-update" } });
      }
      if (path.includes("name-history")) return jsonResponse(updated ? [{
        ...nameHistory[0], id: "history-2", previous_name: "Rice", new_name: "Premium Rice", reason: "Market standard",
      }, ...nameHistory] : nameHistory);
      return jsonResponse([activeProduct]);
    }));
    render(<ProductMasterWorkspace host={productHost()} />);
    await screen.findByText("Rice Old → Rice");

    fireEvent.click(screen.getByRole("button", { name: "Edit product" }));
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "Premium Rice" } });
    fireEvent.change(screen.getByLabelText("Name-change reason"), { target: { value: "Market standard" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await screen.findByText("Rice → Premium Rice");
    expect(commandBodies[0]).toMatchObject({
      command_type: "UpdateProductDefinition",
      payload: { product_definition_id: activeProduct.id, expected_version: 3, canonical_name: "Premium Rice", reason: "Market standard" },
    });
  });

  it("archives and restores with optimistic versions", async () => {
    let current = activeProduct;
    const commandTypes: string[] = [];
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input);
      if (path === "/api/commands") {
        const command = JSON.parse(String(options?.body));
        commandTypes.push(command.command_type);
        current = command.command_type === "ArchiveProductDefinition"
          ? { ...current, status: "archived", version: 4, archived_at: "2026-07-16T12:00:00Z" }
          : { ...current, status: "active", version: 5, archived_at: null };
        return jsonResponse({ result: { ...current, correlation_id: `corr-${current.version}` } });
      }
      if (path.includes("name-history")) return jsonResponse([]);
      return jsonResponse([current]);
    }));
    render(<ProductMasterWorkspace host={productHost()} />);
    await screen.findAllByText("RICE-001");

    await confirmLifecycleAction("Archive product");
    await screen.findByRole("button", { name: "Restore product" });
    fireEvent.click(screen.getByRole("button", { name: "Restore product" }));
    await screen.findByRole("button", { name: "Archive product" });
    expect(commandTypes).toEqual(["ArchiveProductDefinition", "RestoreProductDefinition"]);
  });

  it("reports unauthorized reads through the neutral host callback", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "expired" }, 401)));
    render(<ProductMasterWorkspace host={productHost({ onUnauthorized })} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("reloads owner reads when the neutral module refresh revision changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => String(input).includes("name-history")
      ? Promise.resolve(jsonResponse([]))
      : Promise.resolve(jsonResponse([activeProduct])));
    vi.stubGlobal("fetch", fetchMock);
    const host = productHost();
    const { rerender } = render(<ProductMasterWorkspace host={host} />);
    await screen.findAllByText("RICE-001");
    const listCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes("include_archived=true")).length;
    const before = listCalls();

    rerender(<ProductMasterWorkspace host={{ ...host, moduleRefreshRevision: 1 }} />);
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });
});

async function confirmLifecycleAction(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  const confirmation = await screen.findByRole("alertdialog", { name: "Confirm action" });
  fireEvent.click(within(confirmation).getByRole("button", { name }));
}
