import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShipmentReadinessWorkspace } from "../../web/src/ShipmentReadinessWorkspace";
import {
  attentionSignal,
  deferred,
  intelligenceHost,
  jsonResponse,
  readinessResponse,
  readySignal,
} from "./ShipmentReadinessWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Shipment Readiness session-safe reads", () => {
  it("ignores tenant A completion after logout and tenant B login", async () => {
    const tenantA = deferred<Response>();
    const tenantB = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (
      _input: RequestInfo | URL,
      options?: RequestInit,
    ) => {
      const authorization = (options?.headers as Record<string, string>)?.Authorization;
      return authorization === "Bearer tenant-a" ? tenantA.promise : tenantB.promise;
    }));
    const { rerender } = render(<ShipmentReadinessWorkspace host={intelligenceHost({
      token: "tenant-a",
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    rerender(<ShipmentReadinessWorkspace host={intelligenceHost({ token: "" })} />);
    expect(screen.getByText("Sign in to open Shipment Readiness.")).toBeInTheDocument();
    rerender(<ShipmentReadinessWorkspace host={intelligenceHost({
      token: "tenant-b",
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));

    await act(async () => tenantB.resolve(jsonResponse({
      ...readinessResponse,
      items: [readySignal],
    })));
    await screen.findByRole("heading", { name: readySignal.code });
    await act(async () => tenantA.resolve(jsonResponse({
      ...readinessResponse,
      items: [attentionSignal],
    })));

    expect(screen.getByRole("heading", { name: readySignal.code })).toBeInTheDocument();
    expect(screen.queryByText(attentionSignal.code)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 Shipment readiness signal loaded.",
    );
  });

  it("keeps the newest refresh when an older completion arrives last", async () => {
    const initial = deferred<Response>();
    const latest = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => latest.promise));
    const host = intelligenceHost();
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    rerender(<ShipmentReadinessWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    await act(async () => latest.resolve(jsonResponse({
      ...readinessResponse,
      items: [readySignal],
    })));
    await screen.findByRole("heading", { name: readySignal.code });
    await act(async () => initial.resolve(jsonResponse({
      ...readinessResponse,
      items: [attentionSignal],
    })));

    expect(screen.getByRole("heading", { name: readySignal.code })).toBeInTheDocument();
    expect(screen.queryByText(attentionSignal.code)).not.toBeInTheDocument();
  });

  it("reports loading and refreshing without claiming stale data is current", async () => {
    const initial = deferred<Response>();
    const refresh = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => refresh.promise));
    const host = intelligenceHost();
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Shipment Readiness.",
    );
    await act(async () => initial.resolve(jsonResponse(readinessResponse)));
    await screen.findByRole("heading", { name: attentionSignal.code });
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 Shipment readiness signals loaded.",
    );

    rerender(<ShipmentReadinessWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "Refreshing Shipment Readiness.",
    ));
    expect(screen.getByRole("heading", { name: attentionSignal.code }))
      .toBeInTheDocument();

    await act(async () => refresh.resolve(jsonResponse({
      ...readinessResponse,
      items: [readySignal],
    })));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "1 Shipment readiness signal loaded.",
    ));
  });

  it("does not apply or authorize a stale request after unmount", async () => {
    const response = deferred<Response>();
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => response.promise));
    const { unmount } = render(<ShipmentReadinessWorkspace host={intelligenceHost({
      onUnauthorized,
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => response.resolve(jsonResponse({ detail: "expired" }, 401)));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not carry saved Shipment searches into a new tenant session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(readinessResponse)));
    const host = intelligenceHost({ token: "tenant-a" });
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);
    await screen.findByRole("heading", { name: attentionSignal.code });

    const firstKey = savedViewKeys()[0];
    expect(firstKey).toContain("uok_intelligence_shipment_readiness_session_views:");
    sessionStorage.setItem(firstKey!, JSON.stringify([{
      id: "tenant-a-view",
      name: "Tenant A shipment",
      query: attentionSignal.code,
      filters: {},
      groupBy: "none",
    }]));

    rerender(<ShipmentReadinessWorkspace host={intelligenceHost({
      token: "tenant-b",
    })} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));

    expect(sessionStorage.getItem(firstKey!)).toBeNull();
    const currentKeys = savedViewKeys();
    expect(currentKeys).toHaveLength(1);
    expect(currentKeys[0]).not.toBe(firstKey);
    expect(sessionStorage.getItem(currentKeys[0]!)).toBe("[]");
  });

  it("removes saved-view remnants left by an interrupted prior mount", async () => {
    const staleKey = "uok_intelligence_shipment_readiness_session_views:stale";
    sessionStorage.setItem(staleKey, JSON.stringify([{
      id: "stale-view",
      name: "Prior tenant shipment",
      query: attentionSignal.code,
      filters: {},
      groupBy: "none",
    }]));
    localStorage.setItem(`${staleKey}-legacy`, "legacy");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(readinessResponse)));

    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);
    await screen.findByRole("heading", { name: attentionSignal.code });

    expect(sessionStorage.getItem(staleKey)).toBeNull();
    expect(localStorage.getItem(`${staleKey}-legacy`)).toBeNull();
    expect(savedViewKeys()).toHaveLength(1);
  });
});

function savedViewKeys() {
  return Array.from(
    { length: sessionStorage.length },
    (_, index) => sessionStorage.key(index),
  ).filter((key): key is string => (
    key?.startsWith("uok_intelligence_shipment_readiness_session_views:")
    ?? false
  ));
}
