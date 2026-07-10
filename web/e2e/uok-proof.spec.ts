import { expect, test, type Page } from "@playwright/test";

const sampleProject = {
  id: "project-proof",
  revision: 1,
  name: "UOK Gantt Proof",
  status: "active",
  start: "2026-08-01",
  end: "2026-08-20",
  updated_at: "2026-08-01T00:00:00Z",
};

const sampleSchedule = {
  project: sampleProject,
  capabilities: { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, review_only: false },
  validation: { ok: true, violations: [], warnings: ["Planner is allocated 120% on 2026-08-06"] },
  calculation: {
    engine_version: "uok-cpm-1",
    project_start: "2026-08-03",
    calculated_finish: "2026-08-13",
    target_finish: "2026-08-20",
    target_variance_days: -5,
    independent_validation: { ok: true, violations: [] },
  },
  tasks: [
    {
      id: "task-summary",
      project_id: sampleProject.id,
      version: 1,
      parent_task_id: null,
      wbs: "1",
      title: "Pilot delivery",
      task_type: "summary",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-13",
      duration_days: 9,
      progress: 20,
      sort_order: 0,
      critical: false,
      total_slack_days: 0,
      baseline_start: "2026-08-01",
      baseline_end: "2026-08-12",
      start_variance_days: 0,
      end_variance_days: 1,
    },
    {
      id: "task-1",
      project_id: sampleProject.id,
      version: 1,
      parent_task_id: "task-summary",
      wbs: "1.1",
      title: "Define schedule scope",
      task_type: "task",
      status: "planned",
      start: "2026-08-01",
      end: "2026-08-03",
      duration_days: 3,
      progress: 40,
      sort_order: 1,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-01",
      baseline_end: "2026-08-03",
      start_variance_days: 0,
      end_variance_days: 0,
      scheduling_mode: "manual",
      constraint_type: "must_start_on",
      constraint_date: "2026-08-01",
    },
    {
      id: "task-2",
      project_id: sampleProject.id,
      version: 1,
      parent_task_id: "task-summary",
      wbs: "1.2",
      title: "Build integrated Gantt with dependency validation",
      task_type: "task",
      status: "planned",
      start: "2026-08-04",
      end: "2026-08-10",
      duration_days: 7,
      progress: 0,
      sort_order: 2,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-04",
      baseline_end: "2026-08-09",
      start_variance_days: 0,
      end_variance_days: 1,
    },
    {
      id: "task-3",
      project_id: sampleProject.id,
      version: 1,
      parent_task_id: "task-summary",
      wbs: "1.3",
      title: "Pilot review milestone",
      task_type: "milestone",
      status: "planned",
      start: "2026-08-13",
      end: "2026-08-13",
      duration_days: 0,
      progress: 0,
      sort_order: 3,
      critical: true,
      total_slack_days: 0,
      baseline_start: "2026-08-12",
      baseline_end: "2026-08-12",
      start_variance_days: 1,
      end_variance_days: 1,
      participant_ids: ["party-proof"],
      participant_roles: ["approver"],
      readiness: { ready: false, required_count: 1, blocking_count: 1, blocking_requirement_ids: ["requirement-proof"] },
    },
  ],
  dependencies: [
    {
      id: "dep-1",
      project_id: sampleProject.id,
      predecessor_task_id: "task-1",
      successor_task_id: "task-2",
      dependency_type: "finish_to_start",
      lag_days: 1,
    },
  ],
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: ["2026-08-14"], ignored_periods: [{ start: "2026-08-17", end: "2026-08-18" }] },
  resources: [{
    id: "resource-1", project_id: sampleProject.id, name: "Planner", role: "Scheduling",
    resource_type: "human", capacity_value: 1, capacity_unit: "fte",
    canonical_target_kind: null, canonical_target_id: null, canonical_resolution: null,
    effective_start: null, effective_end: null,
  }],
  assignments: [{ id: "assignment-1", task_id: "task-2", resource_id: "resource-1", allocation_percent: 120 }],
  links: [{
    id: "link-thread-proof",
    project_id: sampleProject.id,
    task_id: "task-1",
    scope_type: "task",
    relationship: "discussed_in",
    blocking: false,
    target: { kind: "communication_thread", id: "thread-proof", resolver: "kconnect.thread", resolver_version: "1" },
    resolution: { status: "ready", display_label: "Pilot K Connect room", status_summary: "Communication thread is open.", checked_at: "2026-08-01T00:00:00Z", open_path: "/?view=communications&thread_id=thread-proof" },
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  }],
  participants: [{
    id: "participant-proof",
    project_id: sampleProject.id,
    task_id: "task-3",
    role: "approver",
    source_module: "contacts.core",
    party: { id: "party-proof", resolver: "contacts.party", resolver_version: "1" },
    resolution: { status: "ready", display_label: "Pilot approver", status_summary: "Party is active.", checked_at: "2026-08-01T00:00:00Z", open_path: "/?view=contacts&party_id=party-proof" },
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  }],
  requirements: [{
    id: "requirement-proof",
    project_id: sampleProject.id,
    task_id: "task-3",
    requirement_type: "approval",
    title: "Pilot execution approval",
    state: "under_review",
    required: true,
    blocking: true,
    target_link_id: null,
    target_link_state: "unlinked",
    due: "2026-08-13",
    decision_reason: null,
    decided_by_actor_id: null,
    decided_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  }],
  readiness: { ready: false, required_count: 1, blocking_count: 1, blocking_requirement_ids: ["requirement-proof"], task_blocker_count: 1 },
  baselines: [{
    id: "baseline-1",
    project_id: sampleProject.id,
    name: "Initial baseline",
    schema_version: 1,
    completeness: "partial",
    checksum: null,
    source_revision: null,
    created_at: "2026-08-01T00:00:00Z",
    integrity: { status: "partial", verified: false, algorithm: null, missing_facts: ["dependencies"], message: "Legacy partial baseline." },
  }],
};

test("UOK proof gate covers planning Gantt usability and visual stability", async ({ page }) => {
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
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openPlanning(page);

    await expect(page.getByRole("heading", { name: "UOK Gantt Proof" })).toBeVisible();
    await expect(page.getByLabel("Gantt toolbar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gantt chart", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Project metadata")).toBeVisible();
    await expect(page.getByLabel("Timeline utilities")).toBeVisible();
    await page.getByLabel("Open planning controls").click();
    await expect(page.getByLabel("Saved planning views")).toBeVisible();
    await expect(page.getByLabel("Planning view name")).toBeVisible();
    await expect(page.getByLabel("Planning search and filters")).toBeVisible();
    await expect(page.getByLabel("Search planning tasks")).toBeVisible();
    await expect(page.getByLabel("Timeline zoom")).toBeVisible();
    await expect(page.getByRole("button", { name: "Selected", exact: true })).toBeVisible();
    await expect(page.getByText("Fields")).toBeVisible();
    await expect(page.getByText("Filter")).toBeVisible();
    await expect(page.getByRole("button", { name: "Columns", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Timeline only", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review mode", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "WBS order", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cascade scheduling", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Level", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Template", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Project JSON", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Timeline SVG", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Document", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
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
    await expect(page.locator(".planning-owned-boundary-marker")).toHaveCount(2);
    await expect(page.locator(".planning-owned-boundary-marker").getByText("Project start")).toBeVisible();
    await expect(page.locator(".planning-owned-boundary-marker").getByText("Project end")).toBeVisible();
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
      await page.getByRole("menuitem", { name: /Duplicate task/ }).click();
      await expect.poll(() => taskPayloads.length).toBe(taskRequests + 1);
      expect(taskPayloads.at(-1)).toMatchObject({ title: "Define schedule scope copy", task_type: "task", parent_task_id: "task-summary", status: "planned", progress: 40 });
      await expect(page.getByLabel("Task scheduling mode")).toHaveValue("manual");
      await expect(page.getByLabel("Task constraint", { exact: true })).toHaveValue("must_start_on");
      await expect(page.getByLabel("Task constraint date")).toHaveValue("2026-08-01");
      const scopeRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" }).first();
      const ganttRow = page.locator(".planning-owned-grid-row").filter({ hasText: "Build integrated Gantt with dependency validation" }).first();
      await expect(ganttRow).toHaveClass(/chain-successor/);
      await expect(page.locator(".planning-owned-dependencies path.chain-highlight")).toHaveCount(1);
      await scopeRow.focus();
      await scopeRow.press("ArrowDown");
      await expect(ganttRow).toBeFocused();
      const taskUpdates = taskUpdatePayloads.length;
      await ganttRow.press("Control+Enter");
      await expect.poll(() => taskUpdatePayloads.length).toBe(taskUpdates + 1);
      expect(taskUpdatePayloads.at(-1)).toMatchObject({ status: "complete", progress: 100 });
      const linkRequests = dependencyPayloads.length;
      await page.getByRole("button", { name: "Start dependency from Define schedule scope" }).press("Enter");
      await expect(page.locator(".planning-gantt-shell")).toHaveClass(/planning-linking/);
      await page.getByRole("button", { name: "Finish dependency at Pilot review milestone" }).press("Enter");
      await expect.poll(() => dependencyPayloads.length).toBe(linkRequests + 1);
      expect(dependencyPayloads.at(-1)).toMatchObject({ predecessor_task_id: "task-1", successor_task_id: "task-3", dependency_type: "finish_to_start", lag_days: 0 });
    }
    await page.getByLabel("Open planning controls").click();
    await page.getByLabel("Search planning tasks").fill("integrated");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".planning-owned-grid-body").getByText("Build integrated Gantt with dependency validation")).toBeVisible();
    await page.getByLabel("Open planning controls").click();
    await page.getByLabel("Search planning tasks").fill("not a visible planning task");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByLabel("No visible planning grid tasks")).toBeVisible();
    await expect(page.getByLabel("No visible planning timeline tasks")).toBeVisible();
    await page.getByLabel("Open planning controls").click();
    await page.getByLabel("Search planning tasks").fill("");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    if (viewport.width > 980) {
      await expect(page.getByRole("complementary", { name: "Planning inspector" })).toBeVisible();
      await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
      await expect(page.getByRole("button", { name: "Show inspector", exact: true })).toBeVisible();
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
      await headers.nth(3).dragTo(headers.nth(2));
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
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(page.getByLabel("Planning board")).toBeVisible();
    await page.getByRole("button", { name: "People", exact: true }).click();
    await expect(page.getByLabel("Planning people")).toContainText("Pilot approver");
    await page.getByRole("button", { name: "Workload", exact: true }).click();
    const workload = page.getByLabel("Planning workload");
    await expect(workload).toBeVisible();
    await expect(workload.getByText("Planner")).toBeVisible();
    await expect(workload.getByText("120% peak")).toBeVisible();
    await expect(workload.getByText("7 overloaded days")).toBeVisible();
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    const criticalPath = page.getByLabel("Critical path explanation");
    await expect(criticalPath).toBeVisible();
    await expect(criticalPath.getByText("3 critical · 3 zero-slack")).toBeVisible();
    await expect(criticalPath.getByText("Define schedule scope")).toBeVisible();
    await expect(criticalPath.getByText("Build integrated Gantt with dependency validation")).toBeVisible();
    await expect(page.getByText("5d early")).toBeVisible();
    await page.getByRole("button", { name: "Gantt chart", exact: true }).click();
    await expect(page.getByLabel("Planning Gantt chart")).toBeVisible();
    await page.getByLabel("Open planning controls").click();
    await expect(page.getByLabel("Participant")).toBeVisible();
    await page.getByRole("button", { name: "Timeline only", exact: true }).click();
    await expect(page.getByRole("button", { name: "Split view", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".planning-owned-grid")).toBeHidden();
    await expect(page.locator(".planning-owned-chart")).toBeVisible();
    await page.getByRole("button", { name: "Split view", exact: true }).click();
    await expect(page.locator(".planning-owned-grid")).toBeVisible();
    await page.getByRole("button", { name: "Review mode", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit mode", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".planning-gantt-shell")).toHaveAttribute("aria-readonly", "true");
    await expect(page.getByRole("button", { name: "Task", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Task actions for Define schedule scope" })).toBeDisabled();
    const reviewShowInspector = page.getByRole("button", { name: "Show inspector", exact: true });
    if (await reviewShowInspector.isVisible()) await reviewShowInspector.click();
    await expect(page.getByRole("button", { name: "Save task" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Level", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
    await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(0);
    await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(0);
    await expect(page.locator(".planning-owned-link-handle")).toHaveCount(0);
    const editHideInspector = page.getByRole("button", { name: "Hide inspector", exact: true });
    if (await editHideInspector.count()) await editHideInspector.evaluate((button) => (button as HTMLButtonElement).click());
    await page.getByLabel("Open planning controls").click();
    await page.getByRole("button", { name: "Edit mode", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("button", { name: "Task", exact: true })).toBeEnabled();
    await expect(page.locator(".planning-owned-resize-handle")).toHaveCount(6);
    await expect(page.locator(".planning-owned-progress-handle")).toHaveCount(3);
    await expect(page.locator(".planning-owned-link-handle")).toHaveCount(8);
    if (viewport.width > 980) {
      const bulkRequests = batchPayloads.length;
      await page.locator(".planning-selection-toggle input").check();
      await expect(page.getByText("4 selected")).toBeVisible();
      await expect(page.getByText("Bulk edits require atomic batch support.")).toHaveCount(0);
      await expect(page.getByLabel("Bulk status")).toBeVisible();
      await expect(page.getByLabel("Bulk progress")).toBeVisible();
      await expect(page.getByLabel("Bulk shift days")).toBeVisible();
      await expect(page.getByRole("button", { name: "Complete selected", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Apply bulk", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Shift dates", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "Apply bulk", exact: true }).click();
      await expect.poll(() => batchPayloads.length).toBe(bulkRequests + 1);
      expect((batchPayloads.at(-1) as { operations: unknown[] }).operations).toHaveLength(4);
      await page.locator(".planning-selection-toggle input").uncheck();
    }
    await page.getByRole("button", { name: "Task", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Task", exact: true })).toBeFocused();
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
    const finalShowInspector = page.getByRole("button", { name: "Show inspector", exact: true });
    if (await finalShowInspector.count()) {
      await finalShowInspector.evaluate((button) => (button as HTMLButtonElement).click());
      await expect(page.locator(".workflow-split-view")).toHaveClass(/secondary-open/);
    }
    await page.getByRole("cell", { name: "1.3", exact: true }).evaluate((cell) => (cell as HTMLElement).click());
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
    const layoutHideInspector = page.getByRole("button", { name: "Hide inspector", exact: true });
    if (await layoutHideInspector.count()) {
      await layoutHideInspector.evaluate((button) => (button as HTMLButtonElement).click());
      await expect(page.locator(".workflow-split-view")).toHaveClass(/secondary-closed/);
    }
    await page.locator(".planning-controls-menu[open]").evaluateAll((menus) => {
      for (const menu of menus) (menu as HTMLDetailsElement).open = false;
    });

    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".shell")?.getBoundingClientRect();
      const workflowHeader = document.querySelector(".planning-workspace .workflow-header")?.getBoundingClientRect();
      const toolbar = document.querySelector(".planning-gantt-toolbar")?.getBoundingClientRect();
      const gantt = document.querySelector(".planning-gantt-shell")?.getBoundingClientRect();
      const ganttTheme = document.querySelector(".planning-gantt-shell .planning-owned-chart svg")?.getBoundingClientRect();
      const firstGanttRow = document.querySelector(".planning-gantt-shell .planning-owned-grid-row")?.getBoundingClientRect();
      const firstGanttChart = document.querySelector(".planning-gantt-shell .planning-owned-chart")?.getBoundingClientRect();
      const inspectorNode = document.querySelector(".workflow-secondary-region");
      const inspectorOpen = inspectorNode?.getAttribute("aria-hidden") !== "true";
      const inspector = inspectorOpen ? inspectorNode?.getBoundingClientRect() : undefined;
      return {
        shellWidth: shell?.width || 0,
        workflowHeaderVisible: Boolean(workflowHeader),
        toolbarHeight: toolbar?.height || 0,
        ganttTop: gantt?.top || 0,
        ganttWidth: gantt?.width || 0,
        ganttHeight: gantt?.height || 0,
        ganttThemeWidth: ganttTheme?.width || 0,
        ganttThemeHeight: ganttTheme?.height || 0,
        firstGanttRowHeight: firstGanttRow?.height || 0,
        firstGanttChartWidth: firstGanttChart?.width || 0,
        firstGanttChartHeight: firstGanttChart?.height || 0,
        overlap: Boolean(gantt && inspector && !(gantt.right <= inspector.left || inspector.right <= gantt.left || gantt.bottom <= inspector.top || inspector.bottom <= gantt.top)),
      };
    });
    expect(layout.shellWidth).toBeGreaterThan(300);
    expect(layout.workflowHeaderVisible).toBe(false);
    if (viewport.width > 980) {
      expect(layout.toolbarHeight).toBeLessThan(320);
      expect(layout.ganttTop).toBeLessThan(360);
    }
    expect(layout.ganttWidth).toBeGreaterThan(viewport.width > 680 ? 280 : 150);
    expect(layout.ganttHeight).toBeGreaterThan(viewport.width > 680 ? Math.max(500, viewport.height - 260) : 460);
    expect(layout.ganttThemeWidth).toBeGreaterThanOrEqual(layout.firstGanttChartWidth - 2);
    expect(layout.ganttThemeHeight).toBeGreaterThan(layout.ganttHeight - 40);
    expect(layout.firstGanttRowHeight).toBeGreaterThanOrEqual(48);
    expect(layout.firstGanttChartHeight).toBeGreaterThan(viewport.width > 680 ? layout.ganttHeight - 40 : 300);
    if (viewport.width > 980) expect(layout.overlap).toBe(false);

    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(15_000);
  }

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect.poll(() => consoleErrors).toEqual([]);
});

test("server review-only capabilities disable Planning writes", async ({ page }) => {
  const reviewOnly = { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, review_only: true };
  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: reviewOnly }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({
    json: { ...sampleSchedule, capabilities: reviewOnly },
    headers: { ETag: `"planning-r1-sha256-${"b".repeat(64)}"` },
  }));

  await openPlanning(page);
  await expect(page.getByRole("status").filter({ hasText: "Server permissions allow review only" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Task", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Baseline", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Level", exact: true })).toBeDisabled();
  await page.getByLabel("Open planning controls").click();
  await expect(page.getByRole("button", { name: "Server review-only", exact: true })).toBeDisabled();
});

test("Planning opens the exact authorized K Connect thread", async ({ page }) => {
  await installMockApi(page, [], [], [], []);
  await openPlanning(page);
  await page.getByRole("cell", { name: "1.1", exact: true }).click();
  const showInspector = page.getByRole("button", { name: "Show inspector", exact: true });
  if (await showInspector.isVisible()) await showInspector.click();
  await page.getByRole("tab", { name: "Links" }).click();
  const threadRow = page.locator(".planning-list-row").filter({ hasText: "Pilot K Connect room" });
  await threadRow.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(/view=communications&thread_id=thread-proof/);
  await expect(page.getByRole("region", { name: "K Connect" })).toBeVisible();
  await expect(page.locator('[data-thread-id="thread-proof"]')).toContainText("Pilot K Connect room");
});

test("Planning mutations remain operable without drag gestures", async ({ page }) => {
  const dependencyPayloads: unknown[] = [];
  const taskPayloads: unknown[] = [];
  const taskUpdatePayloads: unknown[] = [];
  await installMockApi(page, dependencyPayloads, taskPayloads, taskUpdatePayloads, []);
  await openPlanning(page);

  await page.getByRole("button", { name: "Edit Start for Define schedule scope" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Start for Define schedule scope").fill("2026-08-02");
  await page.locator(".planning-owned-inline-cell .inline-edit-form").getByRole("button", { name: "Save" }).click();
  await expect.poll(() => taskUpdatePayloads.at(-1)).toMatchObject({ start: "2026-08-02" });
  await expect(page.getByRole("button", { name: "Edit Start for Define schedule scope" })).toBeFocused();

  await page.getByRole("button", { name: "Edit End for Define schedule scope" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("End for Define schedule scope").fill("2026-08-06");
  await page.locator(".planning-owned-inline-cell .inline-edit-form").getByRole("button", { name: "Save" }).click();
  await expect.poll(() => taskUpdatePayloads.at(-1)).toMatchObject({ end: "2026-08-06" });

  await page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" }).first().click();
  const showInspector = page.getByRole("button", { name: "Show inspector", exact: true });
  if (await showInspector.isVisible()) await showInspector.click();
  await page.getByRole("tab", { name: "Task" }).click();
  const taskEditor = page.getByLabel("Task editor");
  await taskEditor.getByRole("spinbutton", { name: "Progress" }).fill("55");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect.poll(() => taskUpdatePayloads.at(-1)).toMatchObject({ progress: 55 });

  await page.getByRole("button", { name: "Start dependency from Define schedule scope" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Finish dependency at Pilot review milestone" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => dependencyPayloads.at(-1)).toMatchObject({
    predecessor_task_id: "task-1",
    successor_task_id: "task-3",
    dependency_type: "finish_to_start",
  });

  await page.getByRole("button", { name: "Task", exact: true }).click();
  await taskEditor.getByLabel("Title", { exact: true }).fill("Keyboard-created task");
  await taskEditor.getByLabel("Planned start", { exact: true }).fill("2026-08-10");
  await taskEditor.getByLabel("Planned end", { exact: true }).fill("2026-08-12");
  await page.getByRole("button", { name: "Add task" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => taskPayloads.at(-1)).toMatchObject({
    title: "Keyboard-created task",
    start: "2026-08-10",
    end: "2026-08-12",
  });
});

test("structured Planning failures expose repair and audit context", async ({ page }) => {
  await installMockApi(page, [], [], [], []);
  await page.route("/api/planning/tasks/task-1", (route) => route.fulfill({
    status: 400,
    json: {
      error: {
        code: "planning_validation_failed",
        message: "title is required",
        field: "title",
        object_ids: [sampleProject.id, "task-1"],
        repair: "Enter a task title, then retry the same user intent.",
        current_revision: 1,
        correlation_id: "proof-command-correlation",
      },
    },
  }));

  await openPlanning(page);
  await page.getByRole("button", { name: "Edit Task for Define schedule scope" }).click();
  const inlineForm = page.locator(".planning-owned-inline-cell .inline-edit-form");
  await page.getByLabel("Task for Define schedule scope").fill("Invalid title proposal");
  await inlineForm.getByRole("button", { name: "Save" }).click();

  const alert = page.getByRole("alert", { name: "Planning change failed" });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("title is required");
  await expect(alert).toContainText("Enter a task title, then retry the same user intent.");
  await expect(alert).toContainText("Field: title");
  await expect(alert).toContainText("Current revision: 1");
  await expect(alert).toContainText("Audit reference: proof-command-correlation");
});

test("revision-aware undo references its source and rejects a stale inverse", async ({ page }) => {
  const sourceCommandId = "11111111-1111-4111-8111-111111111111";
  const undoCommandId = "22222222-2222-4222-8222-222222222222";
  const inversePayloads: Array<Record<string, unknown>> = [];
  const scheduleState = structuredClone(sampleSchedule);
  let revision = 1;
  let etag = proofEtag(revision);
  await installMockApi(page, [], [], [], []);
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({ json: scheduleState, headers: { ETag: etag } }));
  await page.route("/api/planning/tasks/task-1", async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    Object.assign(scheduleState.tasks.find((task) => task.id === "task-1") as object, payload);
    revision += 1;
    scheduleState.project.revision = revision;
    etag = proofEtag(revision);
    await route.fulfill({ json: { task: scheduleState.tasks[1], correlation_id: sourceCommandId }, headers: { ETag: etag } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/mutations:batch`, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    inversePayloads.push(payload);
    if (route.request().headers()["if-match"] !== etag) {
      await route.fulfill({
        status: 412,
        headers: { ETag: etag },
        json: {
          error: {
            code: "stale_precondition",
            message: "The Planning schedule changed after the inverse was prepared.",
            field: "If-Match",
            repair: "Review the latest schedule before reapplying or keeping it.",
            current_revision: revision,
            current_etag: etag,
            object_ids: [sampleProject.id],
            reload_url: `/api/planning/projects/${sampleProject.id}/schedule`,
            correlation_id: "33333333-3333-4333-8333-333333333333",
          },
        },
      });
      return;
    }
    const operations = payload.operations as Array<{ payload: Record<string, unknown> }>;
    for (const operation of operations) {
      const { task_id: taskId, ...changes } = operation.payload;
      Object.assign(scheduleState.tasks.find((task) => task.id === taskId) as object, changes);
    }
    const previousRevision = revision;
    revision += 1;
    scheduleState.project.revision = revision;
    etag = proofEtag(revision);
    await route.fulfill({
      headers: { ETag: etag },
      json: {
        correlation_id: undoCommandId,
        source_command_id: payload.source_command_id,
        previous_revision: previousRevision,
        revision,
        operation_results: [],
        schedule: scheduleState,
      },
    });
  });

  await openPlanning(page);
  await page.getByRole("button", { name: "Edit Task for Define schedule scope" }).click();
  await page.getByLabel("Task for Define schedule scope").fill("Own audited edit");
  await page.locator(".planning-owned-inline-cell .inline-edit-form").getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Own audited edit" })).toBeVisible();

  await page.getByLabel("Open planning controls").click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" })).toBeVisible();
  expect(inversePayloads[0]).toMatchObject({ source_command_id: sourceCommandId, reason: "Undo Edit task" });
  await page.getByRole("button", { name: "Done", exact: true }).click();

  revision += 1;
  scheduleState.project.revision = revision;
  scheduleState.tasks[1].title = "Remote authoritative edit";
  etag = proofEtag(revision);
  await page.getByLabel("Open planning controls").click();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();

  const alert = page.getByRole("alert", { name: "Planning change needs review" });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Remote authoritative edit" })).toBeVisible();
  expect(inversePayloads[1]).toMatchObject({ source_command_id: undoCommandId, reason: "Redo Edit task" });
});

async function openPlanning(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByRole("region", { name: "Planning", exact: true })).toBeVisible();
}

async function installMockApi(page: Page, dependencyPayloads: unknown[], taskPayloads: unknown[], taskUpdatePayloads: unknown[], batchPayloads: unknown[]) {
  const planningEtag = `"planning-r1-sha256-${"a".repeat(64)}"`;
  await page.addInitScript(() => {
    window.sessionStorage.setItem("uok_token", "proof-token");
    window.localStorage.setItem("uok_user", JSON.stringify({
      username: "admin",
      display_name: "UOK Admin",
      email: "admin@example.test",
      role: "platform_admin",
    }));
  });

  await page.route("/api/dashboard", (route) => route.fulfill({ json: { counts: { planning_projects: 1, planning_tasks: 2 } } }));
  await page.route("/api/baseline-evidence", (route) => route.fulfill({ json: { ok: true, checks: { planning_ui_proof: true } } }));
  await page.route("/api/architecture/alignment", (route) => route.fulfill({ json: { ok: true, checks: { module_neutral_baseline: true } } }));
  await page.route("/api/modules/catalog", (route) => route.fulfill({ json: { modules: moduleCatalog() } }));
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: sampleSchedule.capabilities }));
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [sampleProject] }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({ json: sampleSchedule, headers: { ETag: planningEtag } }));
  await page.route(`/api/planning/projects/${sampleProject.id}/tasks`, async (route) => {
    taskPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" }, headers: { ETag: planningEtag } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/mutations:batch`, async (route) => {
    const payload = route.request().postDataJSON();
    batchPayloads.push(payload);
    await route.fulfill({
      json: { correlation_id: "proof-batch", previous_revision: 1, revision: 2, operation_results: [], schedule: sampleSchedule },
      headers: { ETag: planningEtag },
    });
  });
  await page.route("/api/planning/tasks/**", async (route) => {
    taskUpdatePayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated", correlation_id: "11111111-1111-4111-8111-111111111111" }, headers: { ETag: planningEtag } });
  });
  await page.route(`/api/planning/projects/${sampleProject.id}/dependencies`, async (route) => {
    dependencyPayloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: "validated" }, headers: { ETag: planningEtag } });
  });
  await page.route("/api/contacts**", (route) => route.fulfill({ json: [{ id: "party-proof", display_name: "Pilot approver", status: "active" }] }));
  await page.route("/api/communications/threads", (route) => route.fulfill({ json: [{
    id: "thread-proof", title: "Pilot K Connect room", status: "open", context_type: "planning.task", context_id: "task-1",
    created_by_user_id: "user-proof", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
  }] }));
}

function moduleCatalog() {
  const base = { version: "3.1.0-alpha.3", installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [] };
  return {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", kind: "control_module", required: true, uninstallable: false },
    "agents.core": { ...base, name: "agents.core", status: "available", kind: "capability_module" },
    "contacts.core": { ...base, name: "contacts.core", status: "available", kind: "capability_module" },
    "communications.core": { ...base, name: "communications.core", status: "installed", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", kind: "capability_module" },
  };
}

function proofEtag(revision: number) {
  return `"planning-r${revision}-sha256-${String(revision).padStart(64, "0")}"`;
}
