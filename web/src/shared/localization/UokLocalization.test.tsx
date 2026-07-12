import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { UokLocalizationProvider, useUokLocalization } from "./UokLocalization";

function Probe() {
  const localization = useUokLocalization();
  return <div data-testid="probe">{localization.direction}|{localization.t("nav.planning")}|{localization.t("missing", "Fallback")}|{localization.formatNumber(1234)}</div>;
}

function PlanningProbe() {
  const { t } = useUokLocalization();
  return <div data-testid="planning-probe">{t("planning.gantt.targetFinish")}|{t("planning.portfolio.scheduleHorizon")}|{t("planning.review.archived")}|{t("planning.projectCreate.action")}|{t("planning.projectCreate.reloadFailed.retry")}|{t("command.workspaceEditor")}|{t("command.moveDialog")}|{t("command.moveDialogHint")}</div>;
}

function DateProbe() {
  return <div data-testid="date-probe">{useUokLocalization().formatDate("2026-08-31")}</div>;
}

describe("UOK localization", () => {
  it("provides shared Arabic translation, direction, fallback, and formatting", () => {
    render(<UokLocalizationProvider locale="ar"><Probe /></UokLocalizationProvider>);
    expect(screen.getByTestId("probe")).toHaveTextContent("rtl|التخطيط|Fallback|١٬٢٣٤");
  });

  it("localizes Planning finish markers and the archived review-only notice", () => {
    render(<UokLocalizationProvider locale="ar"><PlanningProbe /></UokLocalizationProvider>);
    expect(screen.getByTestId("planning-probe")).toHaveTextContent("الانتهاء المستهدف|أفق الجدول|المشروع المؤرشف للقراءة فقط");
    expect(screen.getByTestId("planning-probe")).toHaveTextContent("مشروع جديد|إعادة محاولة التحميل|محرر مساحة العمل");
    expect(screen.getByTestId("planning-probe")).toHaveTextContent("نقل|اسحب للتحريك");
  });

  it("formats date-only schedule facts without a UTC day shift", () => {
    render(<UokLocalizationProvider locale="en-US"><DateProbe /></UokLocalizationProvider>);
    expect(screen.getByTestId("date-probe")).toHaveTextContent("Aug 31, 2026");
  });
});
