import { expect, test } from "@playwright/test";

import { installMockApi, openPlanning, proofEtag } from "./support/planningProofApi";
import { sampleProject, sampleSchedule } from "./support/planningProofFixtures";

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

  await page.getByRole("cell", { name: "1.1", exact: true }).click();
  const inspectorDialog = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(inspectorDialog).toBeVisible();
  await page.getByRole("tab", { name: "Task" }).click();
  const taskEditor = page.getByLabel("Task editor");
  await taskEditor.getByRole("spinbutton", { name: "Progress" }).fill("55");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect.poll(() => taskUpdatePayloads.at(-1)).toMatchObject({ progress: 55 });
  const closeInspector = inspectorDialog.getByRole("button", { name: "Close Planning inspector", exact: true });
  await expect(closeInspector).toBeEnabled();
  await closeInspector.click();
  await expect(inspectorDialog).toBeHidden();

  await page.getByRole("button", { name: "Start dependency from Define schedule scope" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Planning inspector", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Finish dependency at Pilot review milestone" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => dependencyPayloads.at(-1)).toMatchObject({
    predecessor_task_id: "task-1",
    successor_task_id: "task-3",
    dependency_type: "finish_to_start",
  });
  await expect(page.getByRole("dialog", { name: "Planning inspector", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(inspectorDialog).toBeVisible();
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

  const searchOptionsTrigger = page.getByRole("button", { name: /^Search options:/ });
  await searchOptionsTrigger.click();
  const searchOptions = page.getByRole("dialog", { name: "Search options", exact: true });
  const planActions = searchOptions.getByRole("region", { name: "Plan actions", exact: true });
  await expect(planActions.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await planActions.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(searchOptionsTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Define schedule scope" })).toBeVisible();
  expect(inversePayloads[0]).toMatchObject({ source_command_id: sourceCommandId, reason: "Undo Edit task" });

  revision += 1;
  scheduleState.project.revision = revision;
  scheduleState.tasks[1].title = "Remote authoritative edit";
  etag = proofEtag(revision);
  await searchOptionsTrigger.click();
  await expect(planActions.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await planActions.getByRole("button", { name: "Redo", exact: true }).click();

  const alert = page.getByRole("alert", { name: "Planning change needs review" });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(page.locator(".planning-owned-grid-row").filter({ hasText: "Remote authoritative edit" })).toBeVisible();
  expect(inversePayloads[1]).toMatchObject({ source_command_id: undoCommandId, reason: "Redo Edit task" });
});
