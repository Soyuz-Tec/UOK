import { expect, test } from "@playwright/test";

import { expectPlanningProjectContext, installMockApi, openPlanning } from "./support/planningProofApi";
import { sampleProject, sampleSchedule } from "./support/planningProofFixtures";

test("server review-only capabilities disable Planning writes", async ({ page }) => {
  const reviewOnly = { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, review_only: true };
  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: reviewOnly }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({
    json: { ...sampleSchedule, capabilities: reviewOnly },
    headers: { ETag: `"planning-r1-sha256-${"b".repeat(64)}"` },
  }));

  await openPlanning(page);
  await expect(page.getByRole("status").filter({ hasText: "Server permissions allow review only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /^Search options:/ }).click();
  await expect(page.getByRole("dialog", { name: "Search options", exact: true }).getByRole("button", { name: "New project", exact: true })).toBeDisabled();
  await page.getByRole("dialog", { name: "Search options", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Open planning controls").click();
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await expect(planningControls.getByRole("button", { name: "Baseline", exact: true })).toBeDisabled();
  await expect(planningControls.getByRole("button", { name: "Level", exact: true })).toBeDisabled();
  await expect(planningControls.getByRole("button", { name: "Server review-only", exact: true })).toBeDisabled();
});

test("Planning local review mode disables project creation in the portfolio", async ({ page }) => {
  await installMockApi(page, [], [], [], []);
  await openPlanning(page);

  await page.getByLabel("Open planning controls").click();
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await planningControls.getByRole("button", { name: "Review mode", exact: true }).click();
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();

  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeDisabled();
});

test("archived Planning schedules stay readable and expose only governed restore", async ({ page }) => {
  const archivedProject = { ...sampleProject, status: "archived" };
  const archivedSchedule = { ...sampleSchedule, project: archivedProject };
  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [archivedProject] }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({
    json: archivedSchedule,
    headers: { ETag: `"planning-r1-sha256-${"c".repeat(64)}"` },
  }));

  await openPlanning(page);
  await expectPlanningProjectContext(page, archivedProject.id, archivedProject.name, "archived");
  await expect(page.getByRole("status").filter({ hasText: "Archived project is read-only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeDisabled();
  const searchOptionsTrigger = page.getByRole("button", { name: /^Search options:/ });
  await searchOptionsTrigger.click();
  const searchOptions = page.getByRole("dialog", { name: "Search options", exact: true });
  const planActions = searchOptions.getByRole("region", { name: "Plan actions", exact: true });
  await expect(planActions.getByRole("button", { name: "New project", exact: true })).toBeEnabled();
  await expect(planActions.getByRole("button", { name: "New sample plan", exact: true })).toBeDisabled();
  await expect(planActions.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await expect(planActions.getByRole("button", { name: "Restore project", exact: true })).toBeEnabled();
  await expect(planActions.getByRole("button", { name: "Delete project", exact: true })).toHaveCount(0);
  await searchOptions.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Open planning controls").click();
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await expect(planningControls.getByRole("button", { name: "Baseline", exact: true })).toBeDisabled();
  await expect(planningControls.getByRole("button", { name: "Level", exact: true })).toBeDisabled();
  await expect(planningControls.getByRole("button", { name: "Server review-only", exact: true })).toBeDisabled();
});

test("Planning portfolio exposes bounded multi-project health and drill-in", async ({ page }) => {
  await installMockApi(page, [], [], [], []);
  await openPlanning(page);
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeVisible();
  const portfolio = page.getByRole("table", { name: "Multi-project delivery portfolio" });
  await expect(portfolio).toBeVisible();
  await expect(page.getByLabel("Current portfolio page metrics")).toContainText("At risk1");
  await expect(page.getByText("6 queries")).toBeVisible();
  await expect(portfolio.getByText("Blocked")).toBeVisible();
  await expect(page.locator(".planning-portfolio-timeline")).toHaveCount(1);
  await page.getByRole("button", { name: `Open project ${sampleProject.name}` }).click();
  await expectPlanningProjectContext(page, sampleProject.id, sampleProject.name, "active");
  await expect(page.getByRole("button", { name: "Project schedule", exact: true })).toHaveAttribute("aria-current", "page");
});
