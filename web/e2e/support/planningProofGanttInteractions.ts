import { expect } from "@playwright/test";

import { openPlanningInspector, type PlanningProofContext } from "./planningProofApi";

export async function verifyPlanningGanttInteractions({
  page,
  viewport,
  dependencyPayloads,
  taskPayloads,
  taskUpdatePayloads,
}: PlanningProofContext) {
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
  await expect(page.locator(".planning-owned-grid-header .column-resize-handle")).toHaveCount(4);
  await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(6);
  await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(3);
  await expect(page.locator(".planning-owned-baseline-lane")).toHaveCount(3);
  await expect(page.locator(".planning-owned-baseline-lane.late").first()).toBeVisible();
  await expect(page.locator(".planning-owned-link-handle")).toHaveCount(8);
  await expect(page.locator(".planning-owned-status-code")).toHaveCount(4);
  await expect(page.locator(".planning-owned-status-code").getByText("CRIT")).toHaveCount(3);
  await expect(page.locator(".planning-owned-tooltip")).toHaveCount(4);
  const boundaryMarkers = page.locator(".planning-owned-boundary-marker");
  await expect(boundaryMarkers).toHaveCount(3);
  await expect(page.getByRole("img", { name: "Project start: 2026-08-01" })).toBeVisible();
  const compatibilityTargetMarker = page.getByRole("img", { name: "Compatibility horizon: 2026-08-20; Target finish: 2026-08-20" });
  await expect(compatibilityTargetMarker).toBeVisible();
  await expect(compatibilityTargetMarker).toHaveClass(/\bend\b/);
  await expect(compatibilityTargetMarker).toHaveClass(/\btarget\b/);
  await expect(compatibilityTargetMarker.getByText("Compatibility horizon / Target finish", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Calculated finish: 2026-08-13" })).toBeVisible();
  await expect(page.locator(".planning-owned-task-marker")).toHaveCount(3);
  await expect(page.getByLabel("Deadline: Define schedule scope")).toBeVisible();
  await expect(page.getByLabel("Baseline variance: Build integrated Gantt with dependency validation")).toBeVisible();
  await expect(page.getByLabel("Milestone: Pilot review milestone")).toBeVisible();
  await expect(page.locator(".planning-owned-task-marker text").filter({ hasText: "DUE" })).toHaveCount(1);
  await expect(page.locator(".planning-owned-task-marker text").filter({ hasText: "VAR" })).toHaveCount(1);
  await expect(page.locator(".planning-owned-task-marker text").filter({ hasText: "MS" })).toHaveCount(1);
  if (viewport.width > 980) {
    const summaryRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Pilot delivery" }).first();
    await expect(summaryRow).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Collapse Pilot delivery" }).click();
    await expect(summaryRow).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand Pilot delivery" }).click();
    await expect(summaryRow).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" })).toHaveCount(1);
    const inlineUpdates = taskUpdatePayloads.length;
    await page.getByRole("button", { name: "Edit Task for Define schedule scope" }).click();
    const inlineForm = page.locator(".planning-owned-inline-cell .inline-edit-form");
    await expect(inlineForm).toBeVisible();
    await page.getByLabel("Task for Define schedule scope").fill("Define schedule scope updated");
    await inlineForm.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => taskUpdatePayloads.length).toBe(inlineUpdates + 1);
    expect(taskUpdatePayloads.at(-1)).toMatchObject({ title: "Define schedule scope updated" });
    const taskRequests = taskPayloads.length;
    await page.getByRole("button", { name: "Task actions for Define schedule scope" }).click();
    await expect(page.getByRole("menu", { name: "Task actions for Define schedule scope" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Planning inspector" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: /Duplicate task/ }).click();
    await expect.poll(() => taskPayloads.length).toBe(taskRequests + 1);
    expect(taskPayloads.at(-1)).toMatchObject({ title: "Define schedule scope copy", task_type: "task", parent_task_id: "task-summary", status: "planned", progress: 40 });
    const { inspectorDialog: taskEditorDialog, planningControlsTrigger: taskInspectorTrigger } = await openPlanningInspector(page);
    await expect(taskEditorDialog.getByLabel("Task scheduling mode")).toHaveValue("manual");
    await expect(taskEditorDialog.getByLabel("Task constraint", { exact: true })).toHaveValue("must_start_on");
    await expect(taskEditorDialog.getByLabel("Task constraint date")).toHaveValue("2026-08-01");
    await taskEditorDialog.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
    await expect(taskInspectorTrigger).toBeFocused();
    const scopeRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" }).first();
    const ganttRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Build integrated Gantt with dependency validation" }).first();
    await expect(ganttRow).toHaveClass(/chain-successor/);
    await expect(page.locator(".planning-owned-dependencies .planning-owned-dependency-line.chain-highlight")).toHaveCount(1);
    await scopeRow.focus();
    await scopeRow.press("ArrowDown");
    await expect(ganttRow).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Planning inspector" })).toHaveCount(0);
    const taskUpdates = taskUpdatePayloads.length;
    await ganttRow.press("Control+Enter");
    await expect.poll(() => taskUpdatePayloads.length).toBe(taskUpdates + 1);
    expect(taskUpdatePayloads.at(-1)).toMatchObject({ status: "complete", progress: 100 });
    const linkRequests = dependencyPayloads.length;
    const dependencyStart = page.getByRole("button", { name: "Start dependency from Define schedule scope" });
    await dependencyStart.focus();
    await expect(dependencyStart).toBeFocused();
    await dependencyStart.press("Enter");
    await expect(page.locator(".planning-gantt-shell")).toHaveClass(/planning-linking/);
    await expect(page.getByRole("dialog", { name: "Planning inspector" })).toHaveCount(0);
    await page.getByRole("button", { name: "Finish dependency at Pilot review milestone" }).press("Enter");
    await expect.poll(() => dependencyPayloads.length).toBe(linkRequests + 1);
    await expect(page.getByRole("dialog", { name: "Planning inspector" })).toHaveCount(0);
    expect(dependencyPayloads.at(-1)).toMatchObject({ predecessor_task_id: "task-1", successor_task_id: "task-3", dependency_type: "finish_to_start", lag_days: 0 });
  }
  await page.getByRole("textbox", { name: "Search planning tasks" }).fill("integrated");
  await expect(page.locator(".planning-owned-grid-body").getByText("Build integrated Gantt with dependency validation")).toBeVisible();
  await page.getByRole("textbox", { name: "Search planning tasks" }).fill("not a visible planning task");
  await expect(page.getByLabel("No visible planning grid tasks")).toBeVisible();
  await expect(page.getByLabel("No visible planning timeline tasks")).toBeVisible();
  await page.getByRole("textbox", { name: "Search planning tasks" }).fill("");
  if (viewport.width > 980) {
    const { inspectorDialog, planningControlsTrigger: inspectorTrigger } = await openPlanningInspector(page);
    await expect(inspectorDialog).toBeVisible();
    await expect(inspectorDialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("button", { name: "Close Planning inspector", exact: true })).toBeFocused();
    await expect(page.getByRole("region", { name: "Planning timeline", exact: true, includeHidden: true })).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(inspectorDialog).toBeHidden();
    await expect(inspectorTrigger).toBeFocused();
    const taskHeader = page.locator(".planning-owned-grid-header [role='columnheader']").nth(1);
    const standardRowHeight = await page.locator(".planning-owned-grid-row").first().evaluate((row) => row.getBoundingClientRect().height);
    await taskHeader.dblclick();
    await expect.poll(() => page.locator(".planning-owned-grid-row").first().evaluate((row) => row.getBoundingClientRect().height)).toBeLessThan(standardRowHeight);
    await taskHeader.dblclick();
    const rowResizeHandle = page.getByRole("separator", { name: "Resize row Define schedule scope" });
    const rowForResize = page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" }).first();
    await expect(rowResizeHandle).toBeVisible();
    await rowResizeHandle.focus();
    const resizeStartHeight = await rowForResize.evaluate((row) => row.getBoundingClientRect().height);
    await rowResizeHandle.press("ArrowDown");
    await expect.poll(() => rowForResize.evaluate((row) => row.getBoundingClientRect().height)).toBeGreaterThan(resizeStartHeight);
    await rowResizeHandle.press("Home");
    await expect.poll(async () => Math.round(await rowForResize.evaluate((row) => row.getBoundingClientRect().height))).toBe(Math.round(resizeStartHeight));
    const headers = page.locator(".planning-owned-grid-header [role='columnheader']");
    await expect(headers.nth(0)).toHaveClass(/planning-owned-pinned-column/);
    await expect(headers.nth(1)).toHaveClass(/planning-owned-pinned-column/);
    await page.evaluate(() => {
      const columns = Array.from(document.querySelectorAll<HTMLElement>(".planning-owned-grid-header [role='columnheader']"));
      const dataTransfer = new DataTransfer();
      columns[3].dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      columns[2].dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      columns[2].dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
    });
    await expect(headers.nth(2)).toHaveText("End");
    await expect(headers.nth(0)).toHaveText("WBS");
    await expect(headers.nth(1)).toHaveText("Task");
    await page.getByRole("button", { name: "Sort by End" }).click();
    await expect(page.locator(".planning-owned-grid-row").first()).toContainText("Define schedule scope");
    await page.getByRole("button", { name: "Column menu for Start" }).click();
    await expect(page.getByRole("menu", { name: "Column actions for Start" })).toBeVisible();
    await page.getByRole("menuitem", { name: /Hide column/ }).click();
    await expect(headers.filter({ hasText: "Start" })).toHaveCount(0);
    await page.getByRole("button", { name: "Column menu for End" }).click();
    await page.getByRole("menuitem", { name: /Show all columns/ }).click();
    await expect(headers.filter({ hasText: "Start" })).toHaveCount(1);
  }
}
