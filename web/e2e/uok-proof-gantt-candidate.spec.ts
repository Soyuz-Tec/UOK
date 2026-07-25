import { expect, test, type Locator } from "@playwright/test";

import { installMockApi, openPlanning } from "./support/planningProofApi";
import { sampleProject, sampleSchedule } from "./support/planningProofFixtures";

test("Planning Gantt 9+ candidate preserves split state, pinned annotations, and dependency semantics", async ({ page }) => {
  test.setTimeout(90_000);
  const candidateSchedule = planningNinePlusSchedule();
  await installMockApi(page, [], [], [], [], candidateSchedule);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlanning(page);

  const splitter = page.getByRole("separator", { name: "Resize task grid and timeline", exact: true });
  const grid = page.locator(".planning-owned-grid");
  const chart = page.locator(".planning-owned-chart");
  await expect(splitter).toHaveAttribute("aria-valuenow", "42");
  const minimumValue = await splitter.getAttribute("aria-valuemin");
  const maximumValue = await splitter.getAttribute("aria-valuemax");
  expect(minimumValue).not.toBeNull();
  expect(maximumValue).not.toBeNull();
  await splitter.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", minimumValue as string);
  const minimumWidths = await planningPaneWidths(grid, chart);
  await splitter.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", maximumValue as string);
  const maximumWidths = await planningPaneWidths(grid, chart);
  expect(maximumWidths.grid).toBeGreaterThan(minimumWidths.grid + 300);
  expect(maximumWidths.chart).toBeLessThan(minimumWidths.chart - 300);
  await splitter.press("Home");
  for (let step = 0; step < 3; step += 1) await splitter.press("Shift+ArrowRight");
  const intermediateValue = await splitter.getAttribute("aria-valuenow");
  expect(Number(intermediateValue)).toBeGreaterThan(Number(minimumValue));
  expect(Number(intermediateValue)).toBeLessThan(Number(maximumValue));

  const planningControlsTrigger = page.getByLabel("Open planning controls");
  const planningControls = page.getByRole("dialog", { name: "Planning controls", exact: true });
  await planningControlsTrigger.click();
  await planningControls.getByLabel("Planning view name").fill("9+ split proof");
  await planningControls.getByRole("button", { name: "Save view", exact: true }).click();
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();
  await splitter.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", maximumValue as string);

  await page.reload();
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByRole("region", { name: "Planning", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Planning view", exact: true })).toHaveValue("Gantt chart");
  await expect(splitter).toHaveAttribute("aria-valuenow", maximumValue as string);
  await planningControlsTrigger.click();
  await planningControls.getByLabel("Select saved view").selectOption({ label: "9+ split proof" });
  await expect(splitter).toHaveAttribute("aria-valuenow", intermediateValue as string);
  await planningControls.getByRole("button", { name: "Timeline only", exact: true }).click();
  await expect(page.getByRole("separator", { name: "Resize task grid and timeline", exact: true })).toHaveCount(0);
  await expect(grid).toBeHidden();
  await expect(chart).toBeVisible();
  await planningControls.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(splitter).toHaveAttribute("aria-valuenow", intermediateValue as string);
  await planningControls.getByRole("button", { name: "Done", exact: true }).click();

  for (const dependency of [
    { id: "candidate-fs", source: "finish", target: "start", label: /Finish to start Dependency.*; Lag 1 day/, compact: "FS +1d" },
    { id: "candidate-ss", source: "start", target: "start", label: /Start to start Dependency.*; No lag/, compact: "SS" },
    { id: "candidate-ff", source: "finish", target: "finish", label: /Finish to finish Dependency.*; Lead 1 day/, compact: "FF -1d" },
    { id: "candidate-sf", source: "start", target: "finish", label: /Start to finish Dependency.*; Lag 2 days/, compact: "SF +2d" },
  ]) {
    const line = page.locator(`.planning-owned-dependency[data-dependency-id="${dependency.id}"]`);
    await expect(line).toHaveAttribute("data-source-port", dependency.source);
    await expect(line).toHaveAttribute("data-target-port", dependency.target);
    await expect(line).toHaveAttribute("aria-label", dependency.label);
    await expect(line.locator(".planning-owned-dependency-label text")).toHaveText(dependency.compact);
  }

  const pinnedBefore = await planningPinnedMarkerTops(chart);
  const layerOrder = await chart.evaluate((node) => {
    const boundaryLines = node.querySelector(".planning-owned-boundary-marker-lines");
    const taskLines = node.querySelector(".planning-owned-task-marker-lines");
    const header = node.querySelector(".planning-owned-header");
    const boundaryAnnotations = node.querySelector(".planning-owned-boundary-marker-annotations");
    const taskAnnotations = node.querySelector(".planning-owned-task-marker-annotations");
    const before = (first: Element | null, second: Element | null) => Boolean(first && second && (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING));
    return before(boundaryLines, header) && before(taskLines, header) && before(header, boundaryAnnotations) && before(header, taskAnnotations);
  });
  expect(layerOrder).toBe(true);
  await expect(page.locator(".planning-owned-boundary-marker-lines")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".planning-owned-task-marker-lines")).toHaveAttribute("aria-hidden", "true");
  const scrollRanges = await page.evaluate(() => {
    const chartNode = document.querySelector<HTMLElement>(".planning-owned-chart");
    const gridNode = document.querySelector<HTMLElement>(".planning-owned-grid-body");
    return {
      chart: (chartNode?.scrollHeight || 0) - (chartNode?.clientHeight || 0),
      grid: (gridNode?.scrollHeight || 0) - (gridNode?.clientHeight || 0),
    };
  });
  expect(scrollRanges.chart).toBeGreaterThan(5_000);
  expect(scrollRanges.grid).toBeGreaterThan(5_000);
  await chart.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => chart.evaluate((node) => node.scrollTop)).toBeGreaterThan(5_000);
  await expect.poll(async () => Math.abs((await pinnedAnnotationOffset(chart, ".planning-owned-boundary-marker-annotations")))).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await pinnedAnnotationOffset(chart, ".planning-owned-task-marker-annotations")))).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await planningPinnedMarkerTops(chart)).header - pinnedBefore.header)).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await planningPinnedMarkerTops(chart)).boundary - pinnedBefore.boundary)).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await planningPinnedMarkerTops(chart)).task - pinnedBefore.task)).toBeLessThanOrEqual(1);
});

async function planningPaneWidths(grid: Locator, chart: Locator) {
  return {
    grid: await grid.evaluate((node) => node.getBoundingClientRect().width),
    chart: await chart.evaluate((node) => node.getBoundingClientRect().width),
  };
}

async function planningPinnedMarkerTops(chart: Locator) {
  return chart.evaluate((node) => {
    const top = (selector: string) => node.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN;
    return {
      header: top(".planning-owned-header"),
      boundary: top(".planning-owned-boundary-marker-annotations text"),
      task: top(".planning-owned-task-marker-annotations .planning-owned-task-marker-surface"),
    };
  });
}

async function pinnedAnnotationOffset(chart: Locator, selector: string) {
  return chart.evaluate((node, markerSelector) => {
    const transform = node.querySelector(markerSelector)?.getAttribute("transform") || "";
    const offset = Number(transform.match(/translate\(0 ([\d.]+)\)/)?.[1] || 0);
    return offset - node.scrollTop;
  }, selector);
}

function planningNinePlusSchedule() {
  const schedule = structuredClone(sampleSchedule);
  const date = (offset: number) => new Date(Date.UTC(2026, 7, 1 + offset)).toISOString().slice(0, 10);
  schedule.tasks = Array.from({ length: 220 }, (_, index) => {
    const startOffset = index % 9;
    const endOffset = startOffset + 2 + (index % 3);
    return {
      id: `candidate-task-${index + 1}`,
      project_id: sampleProject.id,
      version: 1,
      parent_task_id: null,
      wbs: String(index + 1),
      title: `Candidate task ${index + 1}`,
      task_type: "task",
      status: "planned",
      start: date(startOffset),
      end: date(endOffset),
      duration_days: endOffset - startOffset + 1,
      progress: index % 5 === 0 ? 20 : 0,
      sort_order: index,
      critical: true,
      total_slack_days: 0,
      baseline_start: date(startOffset),
      baseline_end: date(endOffset),
      start_variance_days: 0,
      end_variance_days: 0,
    };
  });
  schedule.dependencies = [
    { id: "candidate-fs", project_id: sampleProject.id, predecessor_task_id: "candidate-task-1", successor_task_id: "candidate-task-2", dependency_type: "finish_to_start", lag_days: 1 },
    { id: "candidate-ss", project_id: sampleProject.id, predecessor_task_id: "candidate-task-2", successor_task_id: "candidate-task-3", dependency_type: "start_to_start", lag_days: 0 },
    { id: "candidate-ff", project_id: sampleProject.id, predecessor_task_id: "candidate-task-3", successor_task_id: "candidate-task-4", dependency_type: "finish_to_finish", lag_days: -1 },
    { id: "candidate-sf", project_id: sampleProject.id, predecessor_task_id: "candidate-task-4", successor_task_id: "candidate-task-5", dependency_type: "start_to_finish", lag_days: 2 },
  ];
  schedule.assignments = [];
  schedule.links = [];
  schedule.participants = [];
  schedule.requirements = [];
  return schedule;
}
