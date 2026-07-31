import { expect, test } from "@playwright/test";

import { installScaleApi } from "./planningScaleFixture";

test("500-row Gantt meets the initial interaction and long-task budgets", async ({ page }, testInfo) => {
  await installScaleApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const started = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
  await expect(page.locator(".planning-owned-grid-row").first()).toBeVisible();
  const interactiveMs = await page.evaluate((value) => performance.now() - value, started);
  expect(interactiveMs).toBeLessThan(2_000);

  const boundaryRow = page.locator(".planning-owned-grid-row").last();
  const boundaryText = await boundaryRow.innerText();
  const boundaryNumber = Number(boundaryText.match(/Scale task (\d+)/)?.[1] || 0);
  await boundaryRow.focus();
  await expect(page.locator(":focus")).toContainText(`Scale task ${boundaryNumber}`);
  await page.keyboard.press("ArrowDown");
  const nextRow = page.locator(".planning-owned-grid-row.selected").filter({ hasText: `Scale task ${boundaryNumber + 1}` });
  await expect(nextRow).toBeFocused();

  await page.evaluate(() => { (window as Window & { uokLongTasks?: number[] }).uokLongTasks = []; });
  const grid = page.locator(".planning-owned-grid-body");
  await grid.evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event("scroll")); });
  await page.waitForTimeout(250);
  const renderedRows = await page.locator(".planning-owned-grid-row").count();
  const renderedTasks = await page.locator(".planning-owned-task").count();
  const longTasks = await page.evaluate(() => (window as Window & { uokLongTasks?: number[] }).uokLongTasks || []);
  const evidence = { interactive_ms: Number(interactiveMs.toFixed(2)), rendered_grid_rows: renderedRows, rendered_timeline_tasks: renderedTasks, max_long_task_ms: Math.max(0, ...longTasks) };
  await testInfo.attach("planning-500-row-browser-budget.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  expect(evidence.rendered_grid_rows).toBeGreaterThan(0);
  expect(evidence.rendered_grid_rows).toBeLessThan(100);
  expect(evidence.rendered_timeline_tasks).toBe(evidence.rendered_grid_rows);
  expect(evidence.max_long_task_ms).toBeLessThan(200);
});
