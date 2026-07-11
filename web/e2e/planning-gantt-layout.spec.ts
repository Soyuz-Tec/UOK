import { expect, test, type Locator } from "@playwright/test";

import { ganttLayoutSchedule, installScaleApi } from "./planningScaleFixture";

type Box = { x: number; y: number; width: number; height: number };

test("Gantt task overlays and semantic markers remain collision-free", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await installScaleApi(page, 2, ganttLayoutSchedule);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();

  const narrowTask = page.getByRole("button", {
    name: "One-day critical task with a long title, Critical path task, 45% complete",
  });
  const tooltip = narrowTask.locator(".planning-owned-tooltip");
  await expect(tooltip).toHaveCSS("visibility", "hidden");

  const barLocator = narrowTask.locator(".planning-owned-task-bar");
  await barLocator.click();
  await page.getByRole("button", { name: "Planning" }).hover();
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

  await page.getByRole("button", { name: "Planning" }).hover();
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
