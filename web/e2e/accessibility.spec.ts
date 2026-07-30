import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { installScaleApi } from "./planningScaleFixture";

const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

async function expectNoWcagViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();
  const summary = results.violations.map((violation) => {
    const targets = violation.nodes
      .flatMap((node) => node.target.map((target) => String(target)))
      .join(", ");
    return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} [${targets}]`;
  }).join("\n");

  expect(results.violations, `${state} WCAG violations:\n${summary}`).toEqual([]);
}

test("shell and Planning expose a keyboard skip path and pass WCAG A/AA", async ({ page }) => {
  await installScaleApi(page, 20);
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expectNoWcagViolations(page, "Apps Manager shell");

  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await expect(page.getByLabel("Planning Gantt chart", { exact: true })).toBeVisible();
  await expectNoWcagViolations(page, "Planning module");
});

test("account confirmation passes WCAG A/AA while background content is isolated", async ({ page }) => {
  await installScaleApi(page, 20);
  await page.goto("/");

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Logout" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expectNoWcagViolations(page, "Logout confirmation");
});

test.describe("narrow coarse-pointer reach", () => {
  test.use({
    hasTouch: true,
    viewport: { width: 320, height: 760 },
    deviceScaleFactor: 2,
  });

  test("keeps visible controls reachable, reflowed, and WCAG conformant", async ({ page }) => {
    await installScaleApi(page, 20);
    await page.goto("/");

    const undersizedTargets = await page.locator([
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled]):not([type='checkbox']):not([type='radio']):not([type='hidden'])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[role='button']:not([aria-disabled='true'])",
      "[role='menuitem']:not([aria-disabled='true'])",
      "[role='menuitemradio']:not([aria-disabled='true'])",
      "[role='tab']:not([aria-disabled='true'])",
    ].join(",")).evaluateAll((elements) => elements.flatMap((element) => {
      if (!(element instanceof HTMLElement)) return [];
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      const hidden = style.display === "none"
        || style.visibility === "hidden"
        || bounds.width === 0
        || bounds.height === 0
        || element.closest("[aria-hidden='true'], [inert]");
      if (hidden || (bounds.width >= 44 && bounds.height >= 44)) return [];
      const name = element.getAttribute("aria-label")
        || element.textContent?.trim()
        || element.getAttribute("name")
        || element.tagName.toLowerCase();
      return [`${name}: ${bounds.width.toFixed(1)}x${bounds.height.toFixed(1)}`];
    }));

    expect(undersizedTargets, `Undersized coarse-pointer targets:\n${undersizedTargets.join("\n")}`).toEqual([]);
    const reflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(reflow.documentWidth).toBeLessThanOrEqual(reflow.viewportWidth + 1);
    await expectNoWcagViolations(page, "320px coarse-pointer shell");
  });
});
