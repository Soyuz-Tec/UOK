import { expect, test } from "@playwright/test";

import { expectPlanningProjectContext, installMockApi, openPlanning } from "./support/planningProofApi";
import { sampleProject, sampleSchedule } from "./support/planningProofFixtures";

test("Planning exposes real project creation when no projects exist", async ({ page }) => {
  const projectRequests: Array<{ payload: Record<string, unknown>; idempotencyKey: string | null }> = [];
  const createdProject = {
    ...sampleProject,
    id: "project-created-empty-proof",
    name: "First delivery project",
    start: "2026-10-01",
    end: "2026-10-31",
    target_finish: "2026-10-31",
    calculated_finish: "2026-10-01",
    timezone: "America/New_York",
  };
  const createdEtag = `"planning-r1-sha256-${"e".repeat(64)}"`;
  const createdSchedule = {
    ...sampleSchedule,
    project: createdProject,
    tasks: [], dependencies: [], resources: [], assignments: [], links: [], participants: [], requirements: [], baselines: [],
    validation: { ok: true, violations: [] },
  };
  let projects: typeof sampleProject[] = [];

  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/projects", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: projects });
    expect(method).toBe("POST");
    projectRequests.push({
      payload: route.request().postDataJSON(),
      idempotencyKey: route.request().headers()["idempotency-key"] || null,
    });
    projects = [createdProject];
    return route.fulfill({ json: createdProject, headers: { ETag: createdEtag } });
  });
  await page.route(`/api/planning/projects/${createdProject.id}/schedule`, (route) => route.fulfill({
    json: createdSchedule,
    headers: { ETag: createdEtag },
  }));

  await openPlanning(page);
  await expect(page.getByRole("heading", { name: "Project schedule", exact: true })).toBeVisible();
  const scopeLayout = await page.getByRole("navigation", { name: "Planning scope", exact: true }).evaluate((navigation) => {
    const bounds = navigation.getBoundingClientRect();
    const buttons = Array.from(navigation.querySelectorAll("button")).map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, height: box.height };
    });
    return { height: bounds.height, buttons };
  });
  expect(scopeLayout.buttons).toHaveLength(2);
  expect(scopeLayout.height).toBeLessThanOrEqual(Math.max(...scopeLayout.buttons.map((button) => button.height)) + 12);
  expect(scopeLayout.buttons[0].height).toBeLessThanOrEqual(44);
  expect(scopeLayout.buttons[1].height).toBeLessThanOrEqual(44);
  expect(Math.abs(scopeLayout.buttons[0].y - scopeLayout.buttons[1].y)).toBeLessThanOrEqual(1);
  expect(scopeLayout.buttons[0].right).toBeLessThanOrEqual(scopeLayout.buttons[1].x);
  const trigger = page.getByRole("button", { name: "New project", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "New project", exact: true });
  await expect(dialog.getByRole("form", { name: "New project form" })).toBeVisible();
  await dialog.getByLabel("Project name").fill("  First delivery project  ");
  await dialog.getByLabel("Start date").fill("2026-10-01");
  await dialog.getByLabel("Target finish").fill("2026-10-31");
  await dialog.getByRole("textbox", { name: "Time zone" }).fill("America/New_York");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();

  const projectPicker = page.getByRole("region", { name: "Planning commands", exact: true }).getByRole("combobox", { name: "Project", exact: true });
  await expect(dialog).toBeHidden();
  await expectPlanningProjectContext(page, createdProject.id, createdProject.name, "active");
  await expect(projectPicker).toHaveValue(createdProject.id);
  await expect(projectPicker).toBeFocused();
  expect(projectRequests).toEqual([{
    payload: { name: createdProject.name, start: createdProject.start, end: createdProject.end, timezone: createdProject.timezone },
    idempotencyKey: expect.stringMatching(/^planning-project:/),
  }]);
});

test("Planning recovers a created project after its first schedule load fails without another POST", async ({ page }) => {
  const createdProject = {
    ...sampleProject,
    id: "project-created-reload-proof",
    name: "Recovered delivery project",
    start: "2026-11-01",
    end: "2026-11-30",
    target_finish: "2026-11-30",
    calculated_finish: "2026-11-01",
    timezone: "America/New_York",
  };
  const createdSchedule = {
    ...sampleSchedule,
    project: createdProject,
    tasks: [], dependencies: [], resources: [], assignments: [], links: [], participants: [], requirements: [], baselines: [],
    validation: { ok: true, violations: [] },
  };
  const createdEtag = `"planning-r1-sha256-${"f".repeat(64)}"`;
  let projects: typeof sampleProject[] = [];
  let projectPosts = 0;
  let scheduleLoads = 0;

  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/projects", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: projects });
    projectPosts += 1;
    projects = [createdProject];
    return route.fulfill({ json: createdProject, headers: { ETag: createdEtag } });
  });
  await page.route(`/api/planning/projects/${createdProject.id}/schedule`, (route) => {
    scheduleLoads += 1;
    if (scheduleLoads === 1) return route.fulfill({ status: 503, json: { message: "Schedule temporarily unavailable" } });
    return route.fulfill({ json: createdSchedule, headers: { ETag: createdEtag } });
  });

  await openPlanning(page);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New project", exact: true });
  await dialog.getByLabel("Project name").fill(createdProject.name);
  await dialog.getByLabel("Start date").fill(createdProject.start);
  await dialog.getByLabel("Target finish").fill(createdProject.end);
  await dialog.getByRole("textbox", { name: "Time zone" }).fill(createdProject.timezone);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();

  const recovery = page.getByRole("status", { name: "Created project needs loading", exact: true });
  await expect(dialog).toBeHidden();
  await expect(recovery).toContainText(`${createdProject.name} was created.`);
  await expect(recovery).toContainText("saved successfully");
  await expect(page.getByRole("button", { name: "New project", exact: true })).toHaveCount(0);
  await recovery.getByRole("button", { name: "Retry loading", exact: true }).click();

  await expect(recovery).toBeHidden();
  await expectPlanningProjectContext(page, createdProject.id, createdProject.name, "active");
  await expect(page.getByRole("region", { name: "Planning commands", exact: true }).getByRole("combobox", { name: "Project", exact: true })).toHaveValue(createdProject.id);
  expect(projectPosts).toBe(1);
  expect(scheduleLoads).toBe(2);
});

test("Planning creates and selects a new project through the portfolio command", async ({ page }) => {
  const projectRequests: Array<{ payload: Record<string, unknown>; idempotencyKey: string | null }> = [];
  const createdProject = {
    ...sampleProject,
    id: "project-created-proof",
    name: "New delivery project",
    start: "2026-09-01",
    end: "2026-09-30",
    target_finish: "2026-09-30",
    calculated_finish: "2026-09-01",
    timezone: "Asia/Kolkata",
    revision: 1,
  };
  const createdSchedule = {
    ...sampleSchedule,
    project: createdProject,
    tasks: [],
    dependencies: [],
    resources: [],
    assignments: [],
    links: [],
    participants: [],
    requirements: [],
    baselines: [],
    validation: { ok: true, violations: [] },
  };
  const createdEtag = `"planning-r1-sha256-${"d".repeat(64)}"`;
  let projects = [sampleProject];

  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/projects", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: projects });
    projectRequests.push({
      payload: route.request().postDataJSON(),
      idempotencyKey: route.request().headers()["idempotency-key"] || null,
    });
    projects = [...projects, createdProject];
    return route.fulfill({ json: createdProject, headers: { ETag: createdEtag } });
  });
  await page.route(`/api/planning/projects/${createdProject.id}/schedule`, (route) => route.fulfill({
    json: createdSchedule,
    headers: { ETag: createdEtag },
  }));

  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanning(page);
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  const trigger = page.getByRole("button", { name: "New project", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "New project", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("button", { name: "Move New project", exact: true })).toBeVisible();
  const dialogBounds = await dialog.evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return { left: rect.left, right: rect.right, clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth };
  });
  expect(dialogBounds.left).toBeGreaterThanOrEqual(-1);
  expect(dialogBounds.right).toBeLessThanOrEqual(391);
  expect(dialogBounds.scrollWidth).toBeLessThanOrEqual(dialogBounds.clientWidth + 1);
  await expect(dialog.getByLabel("Project name")).toHaveValue("");
  await expect(dialog.getByLabel("Start date")).toBeVisible();
  await expect(dialog.getByLabel("Target finish")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Time zone" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("Project name").fill("  New delivery project  ");
  await dialog.getByLabel("Start date").fill("2026-09-01");
  await dialog.getByLabel("Target finish").fill("2026-09-30");
  await dialog.getByRole("textbox", { name: "Time zone" }).fill("Asia/Kolkata");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();

  await expect(dialog).toBeHidden();
  await expectPlanningProjectContext(page, createdProject.id, createdProject.name, "active");
  await expect(page.getByRole("region", { name: "Planning commands", exact: true }).getByRole("combobox", { name: "Project", exact: true })).toHaveValue(createdProject.id);
  expect(projectRequests).toEqual([{
    payload: { name: "New delivery project", start: "2026-09-01", end: "2026-09-30", timezone: "Asia/Kolkata" },
    idempotencyKey: expect.stringMatching(/^planning-project:/),
  }]);
});

test("Planning opens the exact authorized K Connect thread", async ({ page }) => {
  await installMockApi(page, [], [], [], []);
  await openPlanning(page);
  await page.getByRole("cell", { name: "1.1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Planning inspector", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Links" }).click();
  const threadRow = page.locator(".planning-list-row").filter({ hasText: "Pilot K Connect room" });
  await threadRow.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(/view=communications&thread_id=thread-proof/);
  await expect(page.getByRole("region", { name: "K Connect", exact: true })).toBeVisible();
  await expect(page.locator('[data-thread-id="thread-proof"]')).toContainText("Pilot K Connect room");
});
