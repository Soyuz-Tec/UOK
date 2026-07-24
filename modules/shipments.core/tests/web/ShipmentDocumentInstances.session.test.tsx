import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentDocumentInstancesPanel } from "../../web/src/ShipmentDocumentInstancesPanel";
import type { ShipmentDocumentInstance } from "../../web/src/shipmentDocumentInstanceTypes";
import {
  instancePanelProps,
  invoiceInstance,
  invoiceType,
  jsonResponse,
  requirementResponse,
} from "./ShipmentDocumentInstances.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Shipment document instance session guards", () => {
  it("discards an old tenant read after the Shipment selection changes", async () => {
    const tenantA = deferred<Response>();
    const tenantBInstance: ShipmentDocumentInstance = {
      ...invoiceInstance,
      id: "tenant-b-instance",
      shipment_id: "tenant-b-shipment",
      document_number: "TENANT-B-INV-9",
    };
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path.endsWith("/document-type-options")) return jsonResponse([invoiceType]);
      if (path.endsWith("/document-requirements")) return jsonResponse(requirementResponse([]));
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? tenantA.promise
        : jsonResponse([tenantBInstance]);
    }));
    const { rerender } = render(
      <ShipmentDocumentInstancesPanel {...instancePanelProps({
        token: "tenant-a",
        shipmentId: "tenant-a-shipment",
      })} />,
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

    rerender(<ShipmentDocumentInstancesPanel {...instancePanelProps({
      token: "tenant-b",
      shipmentId: "tenant-b-shipment",
    })} />);
    expect(await screen.findByText("TENANT-B-INV-9")).toBeInTheDocument();

    await act(async () => tenantA.resolve(jsonResponse([invoiceInstance])));
    expect(screen.getByText("TENANT-B-INV-9")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-0042")).not.toBeInTheDocument();
  });

  it("does not expire the new session when an unmounted read returns unauthorized", async () => {
    const staleRead = deferred<Response>();
    const onUnauthorized = vi.fn();
    const tenantBInstance = {
      ...invoiceInstance,
      id: "tenant-b-instance",
      shipment_id: "tenant-b-shipment",
      document_number: "TENANT-B-INV-10",
    };
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path.endsWith("/document-type-options")) return jsonResponse([invoiceType]);
      if (path.endsWith("/document-requirements")) return jsonResponse(requirementResponse([]));
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? staleRead.promise
        : jsonResponse([tenantBInstance]);
    }));
    const { rerender } = render(
      <ShipmentDocumentInstancesPanel
        key="tenant-a"
        {...instancePanelProps({
          token: "tenant-a",
          shipmentId: "tenant-a-shipment",
          onUnauthorized,
        })}
      />,
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

    rerender(
      <ShipmentDocumentInstancesPanel
        key="tenant-b"
        {...instancePanelProps({
          token: "tenant-b",
          shipmentId: "tenant-b-shipment",
          onUnauthorized,
        })}
      />,
    );
    expect(await screen.findByText("TENANT-B-INV-10")).toBeInTheDocument();
    await act(async () => staleRead.resolve(jsonResponse({ detail: "stale" }, 401)));

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(screen.getByText("TENANT-B-INV-10")).toBeInTheDocument();
  });

  it("discards a mutation completion after tenant and role change", async () => {
    const staleCommand = deferred<Response>();
    const onUnauthorized = vi.fn();
    const onStatus = vi.fn();
    const tenantBInstance = {
      ...invoiceInstance,
      id: "tenant-b-instance",
      shipment_id: "tenant-b-shipment",
      document_number: "TENANT-B-INV-11",
    };
    vi.stubGlobal("crypto", { randomUUID: () => "55555555-5555-4555-8555-555555555555" });
    vi.stubGlobal("fetch", vi.fn(async (
      input: RequestInfo | URL,
      request?: RequestInit,
    ) => {
      const path = String(input);
      if (path === "/api/commands") return staleCommand.promise;
      if (path.endsWith("/document-type-options")) return jsonResponse([invoiceType]);
      if (path.endsWith("/document-requirements")) return jsonResponse(requirementResponse([]));
      const authorization = (request?.headers as Record<string, string>).Authorization;
      return authorization === "Bearer tenant-a"
        ? jsonResponse([invoiceInstance])
        : jsonResponse([tenantBInstance]);
    }));
    const { rerender } = render(
      <ShipmentDocumentInstancesPanel {...instancePanelProps({
        token: "tenant-a",
        shipmentId: "tenant-a-shipment",
        onUnauthorized,
        onStatus,
      })} />,
    );
    await screen.findByText("INV-2026-0042");
    fireEvent.click(screen.getByRole("button", {
      name: "Change status for COMMERCIAL-INVOICE · Commercial Invoice INV-2026-0042",
    }));
    const form = screen.getByRole("form", {
      name: "Change document instance status form",
    });
    fireEvent.change(within(form).getByLabelText("New instance status"), {
      target: { value: "superseded" },
    });
    fireEvent.change(within(form).getByLabelText("Transition reason"), {
      target: { value: "Replacement record expected" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Change status" }));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/commands",
      expect.anything(),
    ));

    rerender(<ShipmentDocumentInstancesPanel {...instancePanelProps({
      token: "tenant-b",
      shipmentId: "tenant-b-shipment",
      canManage: false,
      onUnauthorized,
      onStatus,
    })} />);
    expect(await screen.findByText("TENANT-B-INV-11")).toBeInTheDocument();
    await act(async () => staleCommand.resolve(jsonResponse({ detail: "stale" }, 401)));

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(screen.getByText("TENANT-B-INV-11")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change status for/ }))
      .not.toBeInTheDocument();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
