import { expect } from "@playwright/test";

import { expectPlanningProjectContext, type PlanningProofContext } from "./planningProofApi";
import { sampleProject } from "./planningProofFixtures";

export async function verifyPlanningCommandAndControlSurfaces({ page, viewport }: PlanningProofContext) {
  const planningCommands = page.getByRole("region", { name: "Planning commands", exact: true });
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  const searchOptions = page.getByRole("dialog", { name: "Search options", exact: true });
  await expect(planningCommands).toBeVisible();
  await expect(planningCommands.getByRole("group", { name: "Planning commands query", exact: true })).toBeVisible();
  await expect(planningCommands.getByRole("group", { name: "Planning commands context", exact: true })).toBeVisible();
  await expect(planningCommands.getByRole("group", { name: "Planning commands actions", exact: true })).toBeVisible();
  const planningView = page.getByRole("combobox", { name: "Planning view", exact: true });
  await expect(planningView).toHaveValue("Gantt chart");
  await expect(page.locator(".planning-workspace-heading")).toHaveCount(0);
  const projectSummary = await expectPlanningProjectContext(page, sampleProject.id, sampleProject.name, "active");
  await expect(projectSummary).toContainText("4 visible of 4 tasks, 1 dependencies");
  await expect(page.locator(".planning-inspector-toggle-floating")).toHaveCount(0);
  await expect(page.getByLabel("Timeline utilities")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search planning tasks" })).toBeVisible();
  const searchOptionsTrigger = page.getByRole("button", { name: /^Search options:/ });
  await searchOptionsTrigger.click();
  await expect(searchOptions.getByRole("region", { name: "Filters" })).toBeVisible();
  await expect(searchOptions.getByLabel("Participant filter")).toBeVisible();
  const planActions = searchOptions.getByRole("region", { name: "Plan actions", exact: true });
  await expect(planActions.getByRole("button", { name: "New project", exact: true })).toBeVisible();
  await expect(planActions.getByRole("button", { name: "New sample plan", exact: true })).toBeVisible();
  await expect(planActions.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
  await expect(planActions.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await expect(planActions.getByRole("button", { name: "Redo", exact: true })).toBeVisible();
  if (viewport.width <= 390) {
    await expect(searchOptions).toHaveAttribute("aria-modal", "true");
    const searchOptionsBounds = await searchOptions.evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right, clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth };
    });
    expect(searchOptionsBounds.left).toBeGreaterThanOrEqual(-1);
    expect(searchOptionsBounds.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(searchOptionsBounds.scrollWidth).toBeLessThanOrEqual(searchOptionsBounds.clientWidth + 1);
    if (viewport.width === 390) {
      await planActions.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(searchOptionsTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(searchOptionsTrigger).toBeFocused();
      await searchOptionsTrigger.click();
      await expect(planActions.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
    }
  }
  await searchOptions.getByRole("button", { name: "Done", exact: true }).click();
  await expect(planningCommands.getByRole("button", { name: "New project", exact: true })).toHaveCount(0);
  await expect(planningCommands.getByRole("button", { name: "New sample plan", exact: true })).toHaveCount(0);
  await expect(planningCommands.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
  await expect(planningCommands.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
  await expect(planningCommands.getByRole("button", { name: "Redo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show inspector", exact: true })).toHaveCount(0);
  if (viewport.width === 1440) {
    await searchOptionsTrigger.click();
    await planActions.getByRole("button", { name: "New project", exact: true }).click();
    const createProjectDialog = page.getByRole("dialog", { name: "New project", exact: true });
    await expect(createProjectDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(createProjectDialog).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Project", exact: true })).toBeFocused();
  }
  await page.getByLabel("Open planning controls").click();
  await expect(planningControls).toBeVisible();
  await expect(planningControls.getByLabel("Saved planning views")).toBeVisible();
  await expect(planningControls.getByLabel("Planning view name")).toBeVisible();
  await expect(planningControls.getByLabel("Timeline zoom")).toBeVisible();
  await expect(planningControls.getByRole("checkbox", { name: /selected$/ })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Selected", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("combobox", { name: "Fields", exact: true })).toBeVisible();
  const columnsTrigger = planningControls.getByRole("button", { name: "Columns", exact: true });
  await expect(columnsTrigger).toBeVisible();
  if (viewport.width <= 390) {
    await columnsTrigger.click();
    const visibleFields = page.getByRole("dialog", { name: "Visible fields", exact: true });
    await expect(visibleFields).toBeVisible();
    const fieldsBounds = await visibleFields.evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right, clientWidth: panel.clientWidth, scrollWidth: panel.scrollWidth };
    });
    expect(fieldsBounds.left).toBeGreaterThanOrEqual(-1);
    expect(fieldsBounds.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(fieldsBounds.scrollWidth).toBeLessThanOrEqual(fieldsBounds.clientWidth + 1);
    const startField = visibleFields.getByRole("checkbox", { name: "Start", exact: true });
    const startFieldWasChecked = await startField.isChecked();
    await startField.click();
    expect(await startField.isChecked()).toBe(!startFieldWasChecked);
    await startField.click();
    expect(await startField.isChecked()).toBe(startFieldWasChecked);
    await page.keyboard.press("Escape");
    await expect(columnsTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(planningControls).toBeVisible();
  }
  await expect(planningControls.getByRole("button", { name: "Timeline only", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Review mode", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "WBS order", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Cascade scheduling", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Level", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Show inspector", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Template", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Project JSON", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Timeline SVG", exact: true })).toBeVisible();
  await expect(planningControls.getByRole("button", { name: "Document", exact: true })).toBeVisible();
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
}

export async function verifyPlanningViewportLayout({ page, viewport }: PlanningProofContext) {
  const layout = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const shell = document.querySelector(".shell")?.getBoundingClientRect();
    const workflowHeader = document.querySelector(".planning-workspace .workflow-header")?.getBoundingClientRect();
    const commandBarNode = document.querySelector<HTMLElement>(".planning-command-bar");
    const commandBar = commandBarNode?.getBoundingClientRect();
    const primary = document.querySelector(".planning-workspace > .workflow-primary-region")?.getBoundingClientRect();
    const gantt = document.querySelector(".planning-gantt-shell")?.getBoundingClientRect();
    const ganttTheme = document.querySelector(".planning-gantt-shell .planning-owned-chart svg")?.getBoundingClientRect();
    const firstGanttRow = document.querySelector(".planning-gantt-shell .planning-owned-grid-row")?.getBoundingClientRect();
    const firstGanttChart = document.querySelector(".planning-gantt-shell .planning-owned-chart")?.getBoundingClientRect();
    const overlaps = (first?: DOMRect, second?: DOMRect) => Boolean(first && second && !(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top));
    return {
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
      shellWidth: shell?.width || 0,
      workflowHeaderVisible: Boolean(workflowHeader),
      commandBarClientWidth: commandBarNode?.clientWidth || 0,
      commandBarScrollWidth: commandBarNode?.scrollWidth || 0,
      commandBarLeft: commandBar?.left || 0,
      commandBarRight: commandBar?.right || 0,
      toolbarHeight: commandBar?.height || 0,
      primaryWidth: primary?.width || 0,
      ganttTop: gantt?.top || 0,
      ganttWidth: gantt?.width || 0,
      ganttHeight: gantt?.height || 0,
      ganttThemeWidth: ganttTheme?.width || 0,
      ganttThemeHeight: ganttTheme?.height || 0,
      firstGanttRowHeight: firstGanttRow?.height || 0,
      firstGanttChartWidth: firstGanttChart?.width || 0,
      firstGanttChartHeight: firstGanttChart?.height || 0,
      commandGanttOverlap: overlaps(commandBar, gantt),
    };
  });
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
  expect(layout.commandBarScrollWidth).toBeLessThanOrEqual(layout.commandBarClientWidth + 1);
  expect(layout.commandBarLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.commandBarRight).toBeLessThanOrEqual(layout.documentClientWidth + 1);
  expect(layout.commandGanttOverlap).toBe(false);
  expect(layout.shellWidth).toBeGreaterThan(300);
  expect(layout.workflowHeaderVisible).toBe(false);
  if (viewport.width > 980) {
    expect(layout.toolbarHeight).toBeLessThan(320);
    expect(layout.ganttTop).toBeLessThan(360);
  }
  expect(layout.ganttWidth).toBeGreaterThan(viewport.width > 680 ? 280 : 150);
  expect(layout.ganttWidth).toBeGreaterThanOrEqual(layout.primaryWidth * 0.9);
  expect(layout.ganttHeight).toBeGreaterThan(viewport.width > 680 ? Math.max(500, viewport.height - 260) : 460);
  expect(layout.ganttThemeWidth).toBeGreaterThanOrEqual(layout.firstGanttChartWidth - 2);
  expect(layout.ganttThemeHeight).toBeGreaterThan(layout.ganttHeight - 40);
  expect(layout.firstGanttRowHeight).toBeGreaterThanOrEqual(48);
  expect(layout.firstGanttChartHeight).toBeGreaterThan(viewport.width > 680 ? layout.ganttHeight - 40 : 300);

  const screenshot = await page.screenshot();
  expect(screenshot.length).toBeGreaterThan(15_000);
}
