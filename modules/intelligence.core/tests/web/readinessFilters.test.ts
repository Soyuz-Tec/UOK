import { afterEach, describe, expect, it, vi } from "vitest";

import { filterShipmentReadiness } from "../../web/src/readinessFilters";
import { readySignal } from "./ShipmentReadinessWorkspace.testUtils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Shipment Readiness filters", () => {
  it("matches operational identifiers independently of the browser locale", () => {
    const localeLowerCase = String.prototype.toLocaleLowerCase;
    const localeLower = vi.spyOn(String.prototype, "toLocaleLowerCase")
      .mockImplementation(function (this: string) {
        return localeLowerCase.call(this, "tr-TR");
      });
    const signals = [{
      ...readySignal,
      code: "SHIP-IST-001",
    }];

    expect(filterShipmentReadiness(signals, "ship", "all")).toEqual(signals);
    expect(localeLower).not.toHaveBeenCalled();
  });
});
