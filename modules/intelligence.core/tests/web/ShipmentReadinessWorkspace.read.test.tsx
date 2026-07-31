import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { ShipmentReadinessWorkspace } from "../../web/src/ShipmentReadinessWorkspace";
import {
  attentionSignal,
  intelligenceHost,
  intelligenceModuleRow,
  jsonResponse,
  notAssessedSignal,
  readinessFetchMock,
  readinessResponse,
  readinessUrl,
  readySignal,
} from "./ShipmentReadinessWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Shipment Readiness read workspace", () => {
  it("offers install, enable, and signed-out states through the neutral host", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    const host = intelligenceHost({
      currentUserRole: "platform_admin",
      moduleRows: [{
        ...intelligenceModuleRow,
        status: "available",
        recorded_status: null,
      }],
      moduleAction,
    });
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);

    fireEvent.click(screen.getByRole("button", { name: "Install Shipment Readiness" }));
    expect(moduleAction).toHaveBeenCalledWith("intelligence.core", "install");

    rerender(<ShipmentReadinessWorkspace host={intelligenceHost({
      currentUserRole: "platform_admin",
      moduleRows: [{ ...intelligenceModuleRow, status: "disabled" }],
      moduleAction,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Enable Shipment Readiness" }));
    expect(moduleAction).toHaveBeenCalledWith("intelligence.core", "enable");

    rerender(<ShipmentReadinessWorkspace host={intelligenceHost({
      session: { token: "", generation: 1 },
    })} />);
    expect(screen.getByText("Sign in to open Shipment Readiness.")).toBeInTheDocument();
  });

  it("does not offer module lifecycle mutations to a read-only viewer", () => {
    render(<ShipmentReadinessWorkspace host={intelligenceHost({
      moduleRows: [{
        ...intelligenceModuleRow,
        status: "available",
        recorded_status: null,
      }],
    })} />);

    expect(screen.queryByRole("button", { name: "Install Shipment Readiness" }))
      .not.toBeInTheDocument();
    expect(screen.getByText("A platform administrator must install this module."))
      .toBeInTheDocument();
  });

  it("searches, filters bands, and supports keyboard row selection", async () => {
    vi.stubGlobal("fetch", readinessFetchMock());
    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);
    await screen.findByRole("heading", { name: attentionSignal.code });
    const grid = within(screen.getByRole("grid", { name: "Shipment readiness signals" }));

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search Shipment readiness" }),
      { target: { value: "READY" } },
    );
    expect(grid.getByText(readySignal.code)).toBeInTheDocument();
    expect(grid.queryByText(attentionSignal.code)).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: readySignal.code });

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search Shipment readiness" }),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", {
      name: "Search options: All readiness signals",
    }));
    fireEvent.change(screen.getByLabelText("Readiness filter"), {
      target: { value: "not_assessed" },
    });
    expect(grid.getByText(notAssessedSignal.code)).toBeInTheDocument();
    expect(grid.queryByText(readySignal.code)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Readiness filter"), {
      target: { value: "all" },
    });
    fireEvent.keyDown(screen.getByRole("row", {
      name: `${readySignal.code} Ready`,
    }), { key: "Enter" });
    await screen.findByRole("heading", { name: readySignal.code });
    expect(screen.getByRole("row", { name: `${readySignal.code} Ready` }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("uses one grid tab stop with arrow, Home, and End navigation", async () => {
    vi.stubGlobal("fetch", readinessFetchMock());
    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);
    await screen.findByRole("heading", { name: attentionSignal.code });

    const attentionRow = screen.getByRole("row", {
      name: `${attentionSignal.code} Attention required`,
    });
    const readyRow = screen.getByRole("row", {
      name: `${readySignal.code} Ready`,
    });
    const notAssessedRow = screen.getByRole("row", {
      name: `${notAssessedSignal.code} Not assessed`,
    });
    expect(attentionRow).toHaveAttribute("tabindex", "0");
    expect(readyRow).toHaveAttribute("tabindex", "-1");

    attentionRow.focus();
    fireEvent.keyDown(attentionRow, { key: "ArrowDown" });
    expect(readyRow).toHaveFocus();
    expect(readyRow).toHaveAttribute("aria-selected", "true");
    expect(readyRow).toHaveAttribute("tabindex", "0");
    expect(attentionRow).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(readyRow, { key: "End" });
    expect(notAssessedRow).toHaveFocus();
    expect(notAssessedRow).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(notAssessedRow, { key: "Home" });
    expect(attentionRow).toHaveFocus();
    expect(attentionRow).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(attentionRow, { key: "ArrowUp" });
    expect(attentionRow).toHaveFocus();
    expect(attentionRow).toHaveAttribute("aria-selected", "true");
  });

  it("refreshes from both the command menu and neutral host revision", async () => {
    const fetchMock = readinessFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const host = intelligenceHost();
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);
    await screen.findByRole("heading", { name: attentionSignal.code });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rerender(<ShipmentReadinessWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("renders empty, forbidden, unavailable, and unauthorized states", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ...readinessResponse, items: [] }))
      .mockResolvedValueOnce(jsonResponse({ detail: "intelligence.read required" }, 403))
      .mockResolvedValueOnce(jsonResponse({
        detail: { error: "Shipment readiness source is unavailable." },
      }, 400))
      .mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const host = intelligenceHost({ session: { onUnauthorized } });
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);

    await screen.findByText("No tenant-visible Shipments are available.");
    rerender(<ShipmentReadinessWorkspace host={{ ...host, moduleRefreshRevision: 1 }} />);
    await screen.findByText("intelligence.read required");
    rerender(<ShipmentReadinessWorkspace host={{ ...host, moduleRefreshRevision: 2 }} />);
    await screen.findByText("Shipment readiness source is unavailable.");
    rerender(<ShipmentReadinessWorkspace host={{ ...host, moduleRefreshRevision: 3 }} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it("clears prior signals when a refresh fails closed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(readinessResponse))
      .mockResolvedValueOnce(jsonResponse({
        detail: { error: "Shipment readiness source is unavailable." },
      }, 400));
    vi.stubGlobal("fetch", fetchMock);
    const host = intelligenceHost();
    const { rerender } = render(<ShipmentReadinessWorkspace host={host} />);

    await screen.findByRole("heading", { name: attentionSignal.code });
    rerender(<ShipmentReadinessWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);

    await screen.findByText("Shipment readiness source is unavailable.");
    expect(screen.queryByText(attentionSignal.code)).not.toBeInTheDocument();
    expect(screen.getByText("Use Refresh to try again.")).toBeInTheDocument();
  });

  it("rejects unsafe owner navigation and never calls foreign or mutation endpoints", async () => {
    const expectedUrl = readinessUrl();
    const fetchMock = readinessFetchMock(() => ({
      ...readinessResponse,
      items: [{
        ...attentionSignal,
        open_path: "https://example.invalid/?view=shipments&shipment_id=hidden",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);

    await screen.findByRole("heading", { name: attentionSignal.code });
    expect(screen.queryByRole("link", { name: "Open Shipment" }))
      .not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([input]) => (
      String(input) === expectedUrl
    ))).toBe(true);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === "GET"))
      .toBe(true);
  });

  it("localizes visible readiness copy and numbers in an RTL Arabic surface", async () => {
    vi.stubGlobal("fetch", readinessFetchMock());
    render(
      <UokLocalizationProvider locale="ar">
        <div dir="rtl">
          <ShipmentReadinessWorkspace host={intelligenceHost()} />
        </div>
      </UokLocalizationProvider>,
    );

    const heading = await screen.findByRole("heading", {
      name: attentionSignal.code,
    });
    expect(screen.getByRole("region", { name: "جاهزية الشحنات" }))
      .toBeInTheDocument();
    expect(screen.getByText("٢ من ٣")).toBeInTheDocument();
    expect(screen.getByText("مصدر جاهزية الشحنات متاح.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "فتح الشحنة" })).toBeInTheDocument();
    expect(screen.getByText("١ منتهية، ١ قريبة الانتهاء"))
      .toBeInTheDocument();
    expect(screen.getByText("تاريخ الانتهاء المؤهل التالي"))
      .toBeInTheDocument();
    for (const timezone of screen.getAllByText("UTC", { selector: "bdi" })) {
      expect(timezone).toHaveAttribute("dir", "ltr");
    }
    expect(heading.querySelector("bdi")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("required_documents_missing"))
      .toHaveAttribute("dir", "ltr");
    expect(heading.closest("[dir='rtl']")).toBeInTheDocument();
  });
});
