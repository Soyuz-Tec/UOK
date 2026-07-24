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

import { ShipmentReadinessWorkspace } from "../../web/src/ShipmentReadinessWorkspace";
import {
  attentionSignal,
  currentUtcDate,
  intelligenceHost,
  jsonResponse,
  readinessFetchMock,
  readinessResponseAt,
  readinessUrl,
} from "./ShipmentReadinessWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Shipment Readiness expiry evaluation", () => {
  it("uses the current UTC date explicitly and displays the returned policy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-31T23:59:59.000Z"));
    const fetchMock = readinessFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);

    await screen.findByRole("heading", { name: attentionSignal.code });
    expect(screen.getByLabelText("As-of date")).toHaveValue("2026-07-31");
    const timezone = screen.getByText((_, element) => (
      element?.classList.contains("shipment-readiness-timezone") ?? false
    ));
    expect(timezone).toHaveTextContent("Evaluation timezone: UTC");
    expect(timezone.querySelector("bdi")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText((_, element) => Boolean(
      element?.classList.contains("shipment-readiness-evaluation")
      && element.textContent?.includes("As of Jul 31, 2026 in UTC.")
      && element.textContent?.includes(
        "Expiring soon through Aug 30, 2026 (30 days, inclusive).",
      )
    ))).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      readinessUrl("2026-07-31"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("renders read-only expiry counts, reasons, and the next eligible expiry", async () => {
    const fetchMock = readinessFetchMock();
    const expectedUrl = readinessUrl();
    vi.stubGlobal("fetch", fetchMock);
    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);

    await screen.findByRole("heading", { name: attentionSignal.code });
    expect(screen.getByText("Source:")).toBeInTheDocument();
    expect(screen.getByText("Expired document metadata needs review."))
      .toBeInTheDocument();
    expect(screen.getByText("expired_document_present")).toBeInTheDocument();
    expect(screen.getByText("1 expired, 1 expiring soon")).toBeInTheDocument();
    const expiryEvidence = screen.getByRole("region", {
      name: "Document expiry evidence",
    });
    expect(within(expiryEvidence).getByText("Expiry evaluated").parentElement)
      .toHaveTextContent("2");
    expect(within(expiryEvidence).getByText("Expiry not recorded").parentElement)
      .toHaveTextContent("0");
    expect(within(expiryEvidence).getByText("Expired").parentElement)
      .toHaveTextContent("1");
    expect(within(expiryEvidence).getByText("Expiring soon").parentElement)
      .toHaveTextContent("1");
    expect(within(expiryEvidence).getByText("Next eligible expiry").parentElement)
      .toHaveTextContent("Aug 1, 2026");
    expect(screen.getByRole("link", { name: "Open Shipment" }))
      .toHaveAttribute("href", attentionSignal.open_path);
    expect(fetchMock).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
    for (const command of [
      "New shipment",
      "Edit shipment",
      "Change status",
      "Add requirement",
      "Add document metadata",
    ]) {
      expect(screen.queryByRole("button", { name: command })).not.toBeInTheDocument();
    }
  });

  it("re-reads for a changed As-of date and clears without an invalid read", async () => {
    const fetchMock = readinessFetchMock(readinessResponseAt);
    vi.stubGlobal("fetch", fetchMock);
    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);
    await screen.findByRole("heading", { name: attentionSignal.code });

    const input = screen.getByLabelText("As-of date");
    fireEvent.change(input, { target: { value: "2026-03-07" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      readinessUrl("2026-03-07"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(await screen.findByText((_, element) => Boolean(
      element?.classList.contains("shipment-readiness-evaluation")
      && element.textContent?.includes("Apr 6, 2026")
    ))).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an As-of date.");
    expect(screen.getByText("As-of date required")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it.each([
    ["as_of", { as_of: "2026-07-22" }],
    ["evaluation_timezone", { evaluation_timezone: "America/New_York" }],
    ["expiring_soon_horizon_days", { expiring_soon_horizon_days: 29 }],
    ["expiring_soon_through", { expiring_soon_through: "2026-08-21" }],
  ])("fails closed when response %s does not match the request", async (
    _field,
    override,
  ) => {
    const requestedAsOf = currentUtcDate();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      ...readinessResponseAt(requestedAsOf),
      ...override,
    })));

    render(<ShipmentReadinessWorkspace host={intelligenceHost()} />);

    await screen.findByText(
      "Shipment Readiness response did not match the requested UTC evaluation policy.",
    );
    expect(screen.queryByText(attentionSignal.code)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
