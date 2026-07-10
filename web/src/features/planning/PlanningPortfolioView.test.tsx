import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "../../shared/localization/UokLocalization";
import { PlanningPortfolioView } from "./PlanningPortfolioView";
import type { PlanningPortfolioResponse } from "./portfolioTypes";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Planning portfolio", () => {
  it("shows explainable health, applies bounded filters, and opens a project", async () => {
    const onOpenProject = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(portfolio));
    render(<PlanningPortfolioView token="token" onOpenProject={onOpenProject} />);

    expect(await screen.findByRole("table", { name: "Multi-project delivery portfolio" })).toBeTruthy();
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText(/6 queries/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Project start 2026-08-01.*Schedule horizon 2026-09-03.*Latest task finish 2026-09-03/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "Alpha" } });
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "completed" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain("query=Alpha&status=completed&limit=50&offset=0");
    fireEvent.click(screen.getByRole("button", { name: "Open project Alpha delivery" }));
    expect(onOpenProject).toHaveBeenCalledWith("project-1");
  });

  it("localizes lifecycle statuses and finish authority in Arabic", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(portfolio));
    render(<UokLocalizationProvider locale="ar"><PlanningPortfolioView token="token" onOpenProject={vi.fn()} /></UokLocalizationProvider>);

    expect(await screen.findByRole("table", { name: "محفظة تسليم متعددة المشاريع" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "مسودة" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "معلّق" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "مكتمل" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /أفق الجدول 2026-09-03.*الانتهاء المستهدف 2026-08-31.*آخر انتهاء للمهام 2026-09-03/ })).toBeTruthy();
  });

  it("renders a legacy portfolio payload without inventing unavailable finish facts", async () => {
    const legacyPortfolio = {
      ...portfolio,
      projects: [{
        ...portfolio.projects[0],
        target_finish: undefined,
        calculated_finish: undefined,
        latest_task_finish: undefined,
        schedule_horizon: undefined,
        attention: { ...portfolio.projects[0].attention, project_late: undefined },
      }],
      summary: { ...portfolio.summary, range_end: "2026-08-31" },
    } as unknown as PlanningPortfolioResponse;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(legacyPortfolio));

    render(<PlanningPortfolioView token="token" onOpenProject={vi.fn()} />);

    expect(await screen.findByRole("table", { name: "Multi-project delivery portfolio" })).toBeTruthy();
    const timeline = screen.getByRole("img", { name: "Alpha delivery: Project start 2026-08-01; Compatibility horizon 2026-08-31" });
    expect(timeline).toBeTruthy();
    expect(timeline.getAttribute("aria-label")).not.toMatch(/Schedule horizon|Target finish|Calculated finish|Latest task finish/);
    expect(timeline.querySelector("span")?.getAttribute("style")).not.toMatch(/NaN|Infinity/);
  });
});

function response(body: PlanningPortfolioResponse) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const portfolio: PlanningPortfolioResponse = {
  total: 1, limit: 50, offset: 0, query: "", status: "",
  projects: [{
    id: "project-1", name: "Alpha delivery", status: "active", start: "2026-08-01", end: "2026-08-31", target_finish: "2026-08-31", calculated_finish: "2026-09-02", latest_task_finish: "2026-09-03", schedule_horizon: "2026-09-03", timezone: "UTC", revision: 4, updated_at: "2026-08-01T00:00:00Z",
    metrics: { task_count: 8, completed_task_count: 2, in_progress_task_count: 3, blocked_task_count: 1, milestone_count: 2, dependency_count: 7, completion_percent: 25 },
    attention: { health: "blocked", overdue_task_count: 1, gate_blocker_count: 1, unavailable_blocking_link_count: 0, project_overdue: false, project_late: true, issue_count: 4 },
  }],
  summary: { visible_project_count: 1, total_project_count: 1, task_count: 8, completed_task_count: 2, blocked_task_count: 1, overdue_task_count: 1, gate_blocker_count: 1, at_risk_project_count: 1, status_counts: { active: 1 }, range_start: "2026-08-01", range_end: "2026-09-03" },
  diagnostics: { strategy: "bounded_aggregate_v1", query_count: 6, elapsed_ms: 12.4 },
};
