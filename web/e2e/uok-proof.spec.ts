import { expect, test } from "@playwright/test";

import { installMockApi, openPlanning, type PlanningProofContext } from "./support/planningProofApi";
import { verifyPlanningGanttInteractions } from "./support/planningProofGanttInteractions";
import { verifyPlanningModes, verifyPlanningTimelineAndInspector } from "./support/planningProofModesTimeline";
import { verifyPlanningCommandAndControlSurfaces, verifyPlanningViewportLayout } from "./support/planningProofViewport";

test("UOK proof gate covers planning Gantt usability and visual stability", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const dependencyPayloads: unknown[] = [];
  const taskPayloads: unknown[] = [];
  const taskUpdatePayloads: unknown[] = [];
  const batchPayloads: unknown[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installMockApi(page, dependencyPayloads, taskPayloads, taskUpdatePayloads, batchPayloads);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 760 },
    { width: 700, height: 760 },
    { width: 390, height: 844 },
    { width: 320, height: 760 },
  ]) {
    await page.setViewportSize(viewport);
    await openPlanning(page);
    const context: PlanningProofContext = {
      page,
      viewport,
      dependencyPayloads,
      taskPayloads,
      taskUpdatePayloads,
      batchPayloads,
    };
    await verifyPlanningCommandAndControlSurfaces(context);
    await verifyPlanningGanttInteractions(context);
    await verifyPlanningModes(context);
    await verifyPlanningTimelineAndInspector(context);
    await verifyPlanningViewportLayout(context);
  }

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect.poll(() => consoleErrors).toEqual([]);
});
