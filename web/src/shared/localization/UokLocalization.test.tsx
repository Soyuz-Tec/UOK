import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { UokLocalizationProvider, useUokLocalization } from "./UokLocalization";

function Probe() {
  const localization = useUokLocalization();
  return <div data-testid="probe">{localization.direction}|{localization.t("nav.planning")}|{localization.t("missing", "Fallback")}|{localization.formatNumber(1234)}</div>;
}

describe("UOK localization", () => {
  it("provides shared Arabic translation, direction, fallback, and formatting", () => {
    render(<UokLocalizationProvider locale="ar"><Probe /></UokLocalizationProvider>);
    expect(screen.getByTestId("probe")).toHaveTextContent("rtl|التخطيط|Fallback|١٬٢٣٤");
  });
});
