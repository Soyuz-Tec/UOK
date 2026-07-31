import { expect, test, type Locator } from "@playwright/test";

test.use({ viewport: { width: 800, height: 720 } });

test("closed secondary slides exit toward the physical inline-end edge", async ({ page }) => {
  await page.goto("/");
  const secondary = page.locator(".rtl-secondary-slide-fixture .workflow-secondary-region");

  await page.evaluate(() => {
    document.documentElement.setAttribute("lang", "en-US");
    document.documentElement.setAttribute("dir", "ltr");
    const fixture = document.createElement("div");
    fixture.className = "workflow-split-view secondary-slide secondary-closed rtl-secondary-slide-fixture";
    fixture.innerHTML = `
      <section class="workflow-primary-region">Primary</section>
      <aside class="workflow-secondary-region" style="width: 200px; transition: none">Secondary</aside>
    `;
    document.body.append(fixture);
  });

  expect(await translationX(secondary)).toBeGreaterThan(0);

  await page.locator("html").evaluate((element) => {
    element.setAttribute("dir", "rtl");
  });

  expect(await translationX(secondary)).toBeLessThan(0);
  await expect(secondary).toHaveCSS("inset-inline-end", "16px");

  await page.locator("html").evaluate((element) => {
    element.setAttribute("lang", "ar");
    element.setAttribute("dir", "ltr");
  });

  expect(await translationX(secondary)).toBeGreaterThan(0);
});

test("table resize handles and cell alignment follow the inline-end edge", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.setAttribute("dir", "ltr");
    const fixture = document.createElement("table");
    fixture.className = "resizable-data-table";
    fixture.innerHTML = `
      <thead>
        <tr>
          <th style="width: 200px">
            <span class="resizable-data-table-header-label">Name</span>
            <span class="column-resize-handle"></span>
          </th>
        </tr>
      </thead>
    `;
    document.body.append(fixture);
  });

  const header = page.locator(".resizable-data-table th");
  const handle = page.locator(".column-resize-handle");
  const [ltrHeaderBox, ltrHandleBox] = await Promise.all([header.boundingBox(), handle.boundingBox()]);

  expect(ltrHeaderBox).not.toBeNull();
  expect(ltrHandleBox).not.toBeNull();
  expect(Math.abs(ltrHandleBox!.x + (ltrHandleBox!.width / 2) - (ltrHeaderBox!.x + ltrHeaderBox!.width))).toBeLessThan(1);
  await expect(header).toHaveCSS("text-align", "start");

  await page.locator("html").evaluate((element) => {
    element.setAttribute("dir", "rtl");
  });
  const [rtlHeaderBox, rtlHandleBox] = await Promise.all([header.boundingBox(), handle.boundingBox()]);

  expect(rtlHeaderBox).not.toBeNull();
  expect(rtlHandleBox).not.toBeNull();
  expect(Math.abs(rtlHandleBox!.x + (rtlHandleBox!.width / 2) - rtlHeaderBox!.x)).toBeLessThan(1);
  await expect(header).toHaveCSS("text-align", "start");
});

async function translationX(locator: Locator) {
  return locator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
  });
}
