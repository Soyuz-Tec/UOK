import { expect, test, type Locator } from "@playwright/test";

import { ganttLayoutSchedule, installScaleApi } from "./planningScaleFixture";

type Box = { x: number; y: number; width: number; height: number };

test("Gantt task overlays and semantic markers remain collision-free", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await installScaleApi(page, 2, ganttLayoutSchedule);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();

  const narrowTask = page.getByRole("button", {
    name: "One-day critical task with a long title, Critical path task, 45% complete",
  });
  const tooltip = narrowTask.locator(".planning-owned-tooltip");
  await expect(tooltip).toHaveCSS("visibility", "hidden");

  const barLocator = narrowTask.locator(".planning-owned-task-bar");
  await barLocator.click();
  const inspectorDialog = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(inspectorDialog).toBeVisible();
  await inspectorDialog.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
  await expect(inspectorDialog).toBeHidden();
  await page.getByRole("button", { name: "Planning", exact: true }).hover();
  await expect(tooltip).toHaveCSS("visibility", "hidden");
  await expect(narrowTask.locator(".planning-owned-resize-handle.end")).toHaveCSS("opacity", "0");

  const bar = await requiredBox(barLocator);
  const label = await requiredBox(narrowTask.locator(".planning-owned-task-label-viewport"));
  const status = await requiredBox(narrowTask.locator(".planning-owned-status-surface"));
  const endResize = await requiredBox(narrowTask.locator(".planning-owned-resize-handle.end"));
  const sourceHandle = await requiredBox(narrowTask.locator(".planning-owned-link-handle.source"));
  const baselineCode = await requiredBox(narrowTask.locator(".baseline-code"));
  expect(right(label)).toBeLessThanOrEqual(status.x);
  expect(right(endResize)).toBeLessThanOrEqual(status.x);
  expect(right(status)).toBeLessThanOrEqual(sourceHandle.x);
  expect(intersects(status, baselineCode)).toBe(false);

  await barLocator.hover();
  await expect(tooltip).toHaveCSS("visibility", "visible");
  await expect(narrowTask.locator(".planning-owned-task-label")).toHaveCSS("opacity", "0");
  await expect(narrowTask.locator(".planning-owned-baseline-lane")).toHaveCSS("opacity", "0");
  const header = await requiredBox(page.locator(".planning-owned-header"));
  const chart = await requiredBox(page.locator(".planning-owned-chart"));
  const tooltipSurface = await requiredBox(narrowTask.locator(".planning-owned-tooltip-surface"));
  expect(intersects(header, tooltipSurface)).toBe(false);
  expect(intersects(bar, tooltipSurface)).toBe(false);
  expect(tooltipSurface.x).toBeGreaterThanOrEqual(chart.x);
  expect(right(tooltipSurface)).toBeLessThanOrEqual(right(chart));

  await page.getByRole("button", { name: "Planning", exact: true }).hover();
  const wideTask = page.getByRole("button", {
    name: "Twenty-day integrated Gantt task, Critical path task, 15% complete",
  });
  const wideBar = await requiredBox(wideTask.locator(".planning-owned-task-bar"));
  const wideLabel = await requiredBox(wideTask.locator(".planning-owned-task-label-viewport"));
  const wideStatus = await requiredBox(wideTask.locator(".planning-owned-status-surface"));
  expect(wideLabel.x).toBeGreaterThanOrEqual(wideBar.x);
  expect(right(wideLabel)).toBeLessThanOrEqual(wideStatus.x);
  expect(right(wideStatus)).toBeLessThanOrEqual(right(wideBar));

  await wideTask.locator(".planning-owned-task-bar").hover();
  const wideTooltip = await requiredBox(wideTask.locator(".planning-owned-tooltip-surface"));
  const visibleChart = await requiredBox(page.locator(".planning-owned-chart"));
  expect(wideTooltip.x).toBeGreaterThanOrEqual(visibleChart.x);
  expect(right(wideTooltip)).toBeLessThanOrEqual(right(visibleChart));

  const marker = page.getByLabel("Deadline: One-day critical task with a long title");
  await expect(marker).toBeVisible();
  for (const appearance of ["light", "dark"] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.appearance = value; }, appearance);
    const colors = await marker.evaluate((node) => {
      const surface = node.querySelector(".planning-owned-task-marker-surface");
      const line = node.querySelector("line");
      const text = node.querySelector("text");
      return {
        fill: surface ? getComputedStyle(surface).fill : "none",
        stroke: line ? getComputedStyle(line).stroke : "none",
        text: text ? getComputedStyle(text).fill : "none",
      };
    });
    expect(colors.fill).not.toBe("none");
    expect(colors.stroke).not.toBe("none");
    expect(colors.text).not.toBe("none");
    expect(colors.fill).not.toBe(colors.text);
  }
  await page.evaluate(() => { document.documentElement.dataset.appearance = "system"; });
  expect(consoleErrors).toEqual([]);
});

test("Planning inspector inherits clamped pointer and keyboard popup movement", async ({ page }) => {
  await installScaleApi(page, 2, ganttLayoutSchedule);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByRole("button", {
    name: "One-day critical task with a long title, Critical path task, 45% complete",
  }).locator(".planning-owned-task-bar").click();

  const inspector = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  const moveHandle = inspector.getByRole("button", { name: "Move Planning inspector", exact: true });
  await expect(moveHandle).toBeVisible();
  const initial = await requiredBox(inspector);
  const handleBox = await requiredBox(moveHandle);

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 120, handleBox.y + handleBox.height / 2, { steps: 5 });
  await page.mouse.up();
  const pointerMoved = await requiredBox(inspector);
  expect(pointerMoved.x).toBeGreaterThan(initial.x + 80);

  await moveHandle.focus();
  await moveHandle.press("ArrowLeft");
  const preciseMove = await requiredBox(inspector);
  expect(preciseMove.x).toBeCloseTo(pointerMoved.x - 16, 0);
  await moveHandle.press("Shift+ArrowLeft");
  const acceleratedMove = await requiredBox(inspector);
  expect(acceleratedMove.x).toBeCloseTo(preciseMove.x - 48, 0);
  await expect(moveHandle).toBeFocused();

  await moveHandle.press("Home");
  const keyboardReset = await requiredBox(inspector);
  expect(keyboardReset.x).toBeCloseTo(initial.x, 0);
  expect(keyboardReset.y).toBeCloseTo(initial.y, 0);

  const resetHandleBox = await requiredBox(moveHandle);
  await page.mouse.move(resetHandleBox.x + resetHandleBox.width / 2, resetHandleBox.y + resetHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(4_000, resetHandleBox.y + resetHandleBox.height / 2, { steps: 5 });
  await page.mouse.up();
  const clamped = await requiredBox(inspector);
  expect(clamped.x).toBeGreaterThanOrEqual(-1);
  expect(clamped.y).toBeGreaterThanOrEqual(-1);
  expect(right(clamped)).toBeLessThanOrEqual(1441);
  expect(bottom(clamped)).toBeLessThanOrEqual(901);

  await moveHandle.dblclick();
  const pointerReset = await requiredBox(inspector);
  expect(pointerReset.x).toBeCloseTo(initial.x, 0);
  expect(pointerReset.y).toBeCloseTo(initial.y, 0);
});

async function requiredBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as Box;
}

function right(box: Box) {
  return box.x + box.width;
}

function bottom(box: Box) {
  return box.y + box.height;
}

function intersects(left: Box, rightBox: Box) {
  return !(right(left) <= rightBox.x || right(rightBox) <= left.x || bottom(left) <= rightBox.y || bottom(rightBox) <= left.y);
}
