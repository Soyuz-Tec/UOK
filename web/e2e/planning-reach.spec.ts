import { expect, test } from "@playwright/test";

import { installScaleApi } from "./planningScaleFixture";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test("shared Arabic RTL, touch targets, and narrow reflow remain operable", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await installScaleApi(page, 20);
  await page.goto("/");

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitemradio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-locale", "ar");
  await page.getByRole("menu").press("Escape");

  await page.getByRole("button", { name: "التخطيط" }).click();
  await expect(page.getByLabel("مخطط جانت للتخطيط")).toBeVisible();
  await expect(page.getByRole("table", { name: "شبكة مهام التخطيط" })).toHaveAttribute("aria-rowcount", "21");
  await expect(page.getByLabel("الخط الزمني للتخطيط", { exact: true })).toBeVisible();
  expect(await page.locator(".planning-owned-grid").evaluate((node) => getComputedStyle(node).direction)).toBe("rtl");
  expect(await page.locator(".planning-owned-chart").evaluate((node) => getComputedStyle(node).direction)).toBe("ltr");

  const row = page.locator(".planning-owned-grid-row").first();
  await row.tap();
  await expect(row).toHaveClass(/selected/);
  const menuTarget = await row.getByRole("button", { name: /Task actions/ }).boundingBox();
  expect(menuTarget?.width || 0).toBeGreaterThanOrEqual(44);
  expect(menuTarget?.height || 0).toBeGreaterThanOrEqual(44);
  const unnamedButtons = await page.locator("button").evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim() || button.getAttribute("title"))).length);
  expect(unnamedButtons).toBe(0);

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByLabel("مخطط جانت للتخطيط")).toBeVisible();
  const reflow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(reflow.document).toBeLessThanOrEqual(reflow.viewport + 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByLabel("مخطط جانت للتخطيط")).toBeVisible();
  const zoomedReflow = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(zoomedReflow.document).toBeLessThanOrEqual(zoomedReflow.viewport + 1);
  const screenshot = await page.screenshot();
  expect(screenshot.length).toBeGreaterThan(15_000);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect.poll(() => consoleErrors).toEqual([]);
});
