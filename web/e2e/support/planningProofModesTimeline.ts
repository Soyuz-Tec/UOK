import { expect } from "@playwright/test";

import { openPlanningInspector, type PlanningProofContext } from "./planningProofApi";

export async function verifyPlanningModes({ page, viewport, batchPayloads }: PlanningProofContext) {
  const planningView = page.getByRole("combobox", { name: "Planning view", exact: true });
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  const searchOptions = page.getByRole("dialog", { name: "Search options", exact: true });
  await planningView.selectOption("Board");
  await expect(page.getByLabel("Planning flow board")).toBeVisible();
  await planningView.selectOption("People");
  await expect(page.getByLabel("Planning people")).toContainText("Pilot approver");
  await planningView.selectOption("Workload");
  const workload = page.getByLabel("Planning workload");
  await expect(workload).toBeVisible();
  await expect(workload.getByText("Planner")).toBeVisible();
  await expect(workload.getByText("120% peak")).toBeVisible();
  await expect(workload.getByText("7 overloaded days")).toBeVisible();
  await planningView.selectOption("Dashboard");
  const criticalPath = page.getByLabel("Critical path explanation");
  await expect(criticalPath).toBeVisible();
  await expect(criticalPath.getByText("3 critical · 3 zero-slack")).toBeVisible();
  await expect(criticalPath.getByText("Define schedule scope")).toBeVisible();
  await expect(criticalPath.getByText("Build integrated Gantt with dependency validation")).toBeVisible();
  await expect(page.getByText("5d early")).toBeVisible();
  await planningView.selectOption("Gantt chart");
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
  await page.getByRole("button", { name: /^Search options:/ }).click();
  await expect(searchOptions.getByLabel("Participant filter")).toBeVisible();
  await searchOptions.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Open planning controls").click();
  await planningControls.getByRole("button", { name: "Timeline only", exact: true }).click();
  await expect(planningControls.getByRole("button", { name: "Split view", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".planning-owned-grid")).toBeHidden();
  await expect(page.locator(".planning-owned-chart")).toBeVisible();
  await planningControls.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(page.locator(".planning-owned-grid")).toBeVisible();
  await planningControls.getByRole("button", { name: "Review mode", exact: true }).click();
  await expect(planningControls.getByRole("button", { name: "Edit mode", exact: true })).toHaveAttribute("aria-pressed", "true");
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Planning Gantt chart")).toHaveClass(/planning-readonly-mode/);
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Task actions for Define schedule scope" })).toBeDisabled();
  const { inspectorDialog: reviewInspectorDialog, planningControlsTrigger: reviewShowInspector } = await openPlanningInspector(page);
  await expect(reviewInspectorDialog.getByRole("button", { name: "Save task" })).toBeDisabled();
  await reviewInspectorDialog.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
  await expect(reviewInspectorDialog).toBeHidden();
  await expect(reviewShowInspector).toBeFocused();
  await page.getByRole("button", { name: /^Search options:/ }).click();
  const reviewPlanActions = searchOptions.getByRole("region", { name: "Plan actions", exact: true });
  await expect(reviewPlanActions.getByRole("button", { name: "New project", exact: true })).toBeDisabled();
  await expect(reviewPlanActions.getByRole("button", { name: "New sample plan", exact: true })).toBeDisabled();
  await expect(reviewPlanActions.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await expect(reviewPlanActions.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expect(reviewPlanActions.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  await searchOptions.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Open planning controls").click();
  await expect(planningControls.getByRole("button", { name: "Level", exact: true })).toBeDisabled();
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(0);
  await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(0);
  await expect(page.locator(".planning-owned-link-handle")).toHaveCount(0);
  await page.getByLabel("Open planning controls").click();
  await planningControls.getByRole("button", { name: "Edit mode", exact: true }).click();
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeEnabled();
  await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(6);
  await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(3);
  await expect(page.locator(".planning-owned-link-handle")).toHaveCount(8);
  if (viewport.width > 980) {
    const bulkRequests = batchPayloads.length;
    await page.getByLabel("Open planning controls").click();
    await planningControls.locator(".planning-selection-toggle input").check();
    await expect(planningControls.getByText("4 selected")).toBeVisible();
    await expect(planningControls.getByText("Bulk edits require atomic batch support.")).toHaveCount(0);
    await expect(planningControls.getByLabel("Bulk status")).toBeVisible();
    await expect(planningControls.getByLabel("Bulk progress")).toBeVisible();
    await expect(planningControls.getByLabel("Bulk shift days")).toBeVisible();
    await expect(planningControls.getByRole("button", { name: "Complete selected", exact: true })).toBeEnabled();
    await expect(planningControls.getByRole("button", { name: "Apply bulk", exact: true })).toBeEnabled();
    await expect(planningControls.getByRole("button", { name: "Shift dates", exact: true })).toBeEnabled();
    await planningControls.getByRole("button", { name: "Apply bulk", exact: true }).click();
    await expect.poll(() => batchPayloads.length).toBe(bulkRequests + 1);
    expect((batchPayloads.at(-1) as { operations: unknown[] }).operations).toHaveLength(4);
    await planningControls.locator(".planning-selection-toggle input").uncheck();
    await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  }
}

export async function verifyPlanningTimelineAndInspector({ page, viewport, taskPayloads }: PlanningProofContext) {
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await page.getByRole("button", { name: "New task", exact: true }).focus();
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeFocused();
  await expect.poll(() => page.locator(".planning-gantt-shell").getByText("Build integrated Gantt with dependency validation").count()).toBeGreaterThan(0);
  await page.getByLabel("Open planning controls").click();
  for (const scale of ["minute", "hour", "day", "week", "sprint", "stage", "month", "quarter", "year"]) {
    await expect(page.getByRole("button", { name: scale, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "minute", exact: true }).click();
  await expect(page.getByText("Subday zoom is visual; schedule changes snap to whole project dates.")).toBeVisible();
  await page.getByRole("button", { name: "day", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  if (viewport.width > 980) {
    const chart = page.locator(".planning-owned-chart");
    const visibleDayLabelCount = () => chart.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return Array.from(node.querySelectorAll(".planning-owned-header text")).filter((label) => {
        const value = label.textContent || "";
        const rect = label.getBoundingClientRect();
        return /^\d+$/.test(value) && rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2;
      }).length;
    });
    await chart.hover();
    const baseDayCount = await visibleDayLabelCount();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, 240);
    await page.keyboard.up("Control");
    await expect.poll(visibleDayLabelCount).toBeGreaterThan(baseDayCount);
    const expandedDayCount = await visibleDayLabelCount();
    await page.getByLabel("Open planning controls").click();
    await expect(page.getByRole("button", { name: "day", exact: true })).toHaveClass(/selected/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const beforePan = await chart.evaluate((node) => node.scrollLeft);
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const panY = box.y + Math.min(box.height - 12, 246);
      await page.mouse.move(box.x + 360, panY);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, panY, { steps: 4 });
      await page.mouse.up();
    }
    await expect.poll(() => chart.evaluate((node) => node.scrollLeft)).toBeGreaterThan(beforePan);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -240);
    await page.keyboard.up("Control");
    await expect.poll(visibleDayLabelCount).toBeLessThan(expandedDayCount);
    await page.getByLabel("Open planning controls").click();
    await expect(page.getByRole("button", { name: "day", exact: true })).toHaveClass(/selected/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const rangeTaskRequests = taskPayloads.length;
    await chart.evaluate((node) => { node.scrollLeft = 0; });
    const createBox = await chart.boundingBox();
    expect(createBox).not.toBeNull();
    if (createBox) {
      const createY = createBox.y + Math.min(createBox.height - 14, 246);
      await page.keyboard.down("Shift");
      await page.mouse.move(createBox.x + 180, createY);
      await page.mouse.down();
      await page.mouse.move(createBox.x + 300, createY, { steps: 4 });
      await expect(page.locator(".planning-owned-create-draft")).toBeVisible();
      await page.mouse.up();
      await page.keyboard.up("Shift");
    }
    await expect.poll(() => taskPayloads.length).toBe(rangeTaskRequests + 1);
    expect(taskPayloads.at(-1)).toMatchObject({ title: "Timeline task", task_type: "task", status: "planned", progress: 0 });
    expect(String((taskPayloads.at(-1) as { start?: unknown }).start)).toMatch(/^2026-08-/);
    expect(String((taskPayloads.at(-1) as { end?: unknown }).end)).toMatch(/^2026-08-/);
    await chart.evaluate((node) => { node.scrollLeft = 0; });
    await page.getByLabel("Open planning controls").click();
    await page.getByRole("button", { name: "Selected", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(() => chart.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Pilot review milestone" }).first()).toHaveClass(/selected/);
    await chart.evaluate((node) => { node.scrollLeft = 0; });
    await page.getByLabel("Open planning controls").click();
    await page.getByLabel("Timeline target date").fill("2026-08-13");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(() => chart.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await page.getByLabel("Open planning controls").click();
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await expect(page.getByRole("button", { name: "month", exact: true })).toHaveClass(/selected/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(() => chart.evaluate((node) => Math.round(node.scrollLeft))).toBe(0);
  }
  await page.getByLabel("Open planning controls").click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.locator(".planning-timeline-workbench")).toHaveClass(/focus-mode/);
  await expect(page.getByRole("button", { name: "Exit focus", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Exit focus", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".planning-timeline-workbench")).not.toHaveClass(/focus-mode/);
  await page.getByRole("cell", { name: "1.3", exact: true }).click();
  const taskInspectorDialog = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(taskInspectorDialog).toBeVisible();
  await expect(page.getByLabel("Selected task")).toContainText("Pilot review milestone");
  await page.getByRole("tab", { name: "Task" }).click();
  await expect(page.getByLabel("Task editor")).toBeVisible();
  await expect(page.getByLabel("Planned start")).toBeVisible();
  await expect(page.getByLabel("Planned end")).toBeVisible();
  await expect(page.getByLabel("Task execution dates")).toBeVisible();
  await expect(page.getByText(/hour and minute zoom are visual only/i)).toBeVisible();
  await page.getByRole("tab", { name: "People" }).click();
  const participantsPanel = page.getByLabel("Task participants");
  await expect(participantsPanel).toContainText("Pilot approver");
  await expect(participantsPanel.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/?view=contacts&party_id=party-proof");
  await page.getByRole("tab", { name: "Gates" }).click();
  const gatesPanel = page.getByLabel("Task gates and requirements");
  await expect(gatesPanel).toContainText("Not ready · 1 required blocker(s).");
  await expect(gatesPanel).toContainText("Pilot execution approval");
  await gatesPanel.getByLabel("Decision reason").fill("Pilot approval reviewed");
  await expect(gatesPanel.getByRole("button", { name: "Satisfy" })).toBeEnabled();
  await page.getByRole("tab", { name: "Dependencies" }).click();
  await expect(page.getByLabel("Dependency editor")).toBeVisible();
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByLabel("Calendar and baseline")).toBeVisible();
  await expect(page.getByLabel("Ignored periods")).toHaveValue("2026-08-17..2026-08-18");
  await expect(page.getByRole("status").filter({ hasText: "Legacy partial baseline: Initial baseline" })).toBeVisible();
  await page.getByRole("tab", { name: "Resources" }).click();
  await expect(page.getByLabel("Resource assignments")).toBeVisible();
  await page.getByRole("tab", { name: "Status" }).click();
  await expect(page.getByLabel("Planning validation status")).toBeVisible();
  await taskInspectorDialog.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
  await expect(taskInspectorDialog).toBeHidden();
  await expect.poll(() => page.locator(".planning-gantt-shell").evaluate((node) => node.getBoundingClientRect().width))
    .toBeGreaterThan(viewport.width > 680 ? 280 : 150);
  const planningControlPanel = page.locator(".planning-controls-menu");
  if (await planningControlPanel.getAttribute("data-open") === "true") {
    await page.keyboard.press("Escape");
    await expect(planningControlPanel).toHaveAttribute("data-open", "false");
  }
}
