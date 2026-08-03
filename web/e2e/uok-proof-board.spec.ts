import { expect, test } from "@playwright/test";

import { installMockApi, openPlanning, proofEtag } from "./support/planningProofApi";
import { sampleProject, sampleSchedule } from "./support/planningProofFixtures";

test("Planning Board supports direct drag, inline title edit, card opening, and guarded reloads", async ({ page }) => {
  const boardSchedule = structuredClone(sampleSchedule);
  const statuses = ["complete", "planned", "planned", "blocked"] as const;
  boardSchedule.tasks = boardSchedule.tasks.map((task, index) => ({ ...task, status: statuses[index] }));
  const movedTask = boardSchedule.tasks.find((task) => task.id === "task-1");
  if (!movedTask) throw new Error("Board proof task is missing");

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const taskUpdates: Array<{ method: string; payload: unknown; ifMatch: string | undefined; idempotencyKey: string | undefined }> = [];
  let scheduleLoads = 0;
  let revision = 1;
  let etag = proofEtag(revision);
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installMockApi(page, [], [], [], [], boardSchedule);
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => {
    scheduleLoads += 1;
    return route.fulfill({ json: boardSchedule, headers: { ETag: etag } });
  });
  await page.route(`/api/planning/tasks/${movedTask.id}`, async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { status?: typeof movedTask.status; title?: string };
    taskUpdates.push({
      method: request.method(),
      payload,
      ifMatch: request.headers()["if-match"],
      idempotencyKey: request.headers()["idempotency-key"],
    });
    if (payload.status) movedTask.status = payload.status;
    if (payload.title) movedTask.title = payload.title;
    revision += 1;
    boardSchedule.project.revision = revision;
    etag = proofEtag(revision);
    await route.fulfill({
      json: {
        task: movedTask,
        validation: boardSchedule.validation,
        revision,
        correlation_id: "board-direct-interaction-proof",
      },
      headers: { ETag: etag },
    });
  });

  await openPlanning(page);
  await page.getByRole("combobox", { name: "Planning view", exact: true }).selectOption("Board");

  const board = page.getByRole("region", { name: "Planning flow board", exact: true });
  await expect(board).toBeVisible();
  for (const lane of ["Planned, 2 tasks", "In progress, 0 tasks", "Blocked, 1 task", "Complete, 1 task"]) {
    await expect(board.getByRole("region", { name: lane, exact: true })).toBeVisible();
  }

  const plannedLane = board.getByRole("region", { name: "Planned, 2 tasks", exact: true });
  const sourceCard = board.locator('article[data-planning-task-id="task-1"]');
  const editTitle = sourceCard.getByRole("button", { name: "Edit Task title for Define schedule scope", exact: true });
  const editMark = editTitle.locator("svg");
  const moreActions = sourceCard.getByRole("button", { name: "More actions for Define schedule scope", exact: true });
  await expect(editMark).toHaveCSS("opacity", "0");
  await expect(moreActions).toHaveCSS("opacity", "0");
  await sourceCard.hover({ position: { x: 8, y: 8 } });
  await expect(editMark).toHaveCSS("opacity", "0.38");
  await expect(moreActions).toHaveCSS("opacity", "0.38");
  await sourceCard.getByRole("button", { name: "Open task Define schedule scope", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(editTitle).toBeFocused();
  await expect(editMark).toHaveCSS("opacity", "1");
  await moreActions.hover();
  await expect(moreActions).toHaveCSS("opacity", "1");
  await moreActions.click();
  const sourceMenu = page.getByRole("dialog", { name: "More actions for Define schedule scope", exact: true });
  await expect(sourceMenu).toBeVisible();
  const menuBox = await sourceMenu.boundingBox();
  const laterCardBox = await plannedLane.locator("article").nth(1).boundingBox();
  expect(menuBox && laterCardBox && menuBox.y + menuBox.height > laterCardBox.y).toBe(true);
  await sourceMenu.getByRole("button", { name: "Move to Complete", exact: true }).click({ trial: true });
  await page.keyboard.press("Escape");
  await expect(sourceMenu).toBeHidden();
  await expect(plannedLane.locator("article")).toHaveCount(2);

  const destinationLane = board.getByRole("region", { name: "In progress, 0 tasks", exact: true });
  await sourceCard.dragTo(destinationLane);

  await expect.poll(() => taskUpdates).toHaveLength(1);
  expect(taskUpdates[0]).toEqual({
    method: "PATCH",
    payload: { status: "in_progress" },
    ifMatch: proofEtag(1),
    idempotencyKey: expect.stringMatching(/^planning-task-update:/),
  });
  await expect.poll(() => scheduleLoads).toBe(2);
  await expect(board.getByRole("region", { name: "Planned, 1 task", exact: true })).toBeVisible();
  const destination = board.getByRole("region", { name: "In progress, 1 task", exact: true });
  const movedCard = destination.locator('article[data-planning-task-id="task-1"]');
  await expect(movedCard).toContainText("Define schedule scope");
  await expect(page.getByRole("status").filter({ hasText: "Define schedule scope moved to In progress." })).toBeVisible();
  const movedOpenSurface = board.getByRole("button", { name: "Open task Define schedule scope", exact: true });
  await expect(movedOpenSurface).toBeFocused();

  await movedCard.getByRole("button", { name: "Edit Task title for Define schedule scope", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Planning inspector", exact: true })).toBeHidden();
  const titleInput = movedCard.getByRole("textbox", { name: "Task title for Define schedule scope", exact: true });
  await titleInput.fill("Define governed schedule scope");
  await movedCard.getByRole("button", { name: "Save", exact: true }).click();

  await expect.poll(() => taskUpdates).toHaveLength(2);
  expect(taskUpdates[1]).toEqual({
    method: "PATCH",
    payload: { title: "Define governed schedule scope" },
    ifMatch: proofEtag(2),
    idempotencyKey: expect.stringMatching(/^planning-task-update:/),
  });
  await expect.poll(() => scheduleLoads).toBe(3);
  await expect(movedCard).toContainText("Define governed schedule scope");
  await expect(movedCard.getByRole("button", { name: "Edit Task title for Define governed schedule scope", exact: true })).toBeFocused();

  await movedCard.click({ position: { x: 18, y: 86 } });
  const inspector = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(inspector).toBeVisible();
  await inspector.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
  const renamedOpenSurface = board.getByRole("button", { name: "Open task Define governed schedule scope", exact: true });
  await expect(renamedOpenSurface).toBeFocused();
  await expect.poll(() => consoleErrors).toEqual([]);
  await expect.poll(() => pageErrors).toEqual([]);
});

test("Planning Board remains inspectable and mutation-free in server review-only mode", async ({ page }) => {
  const reviewOnly = { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, review_only: true };
  const boardSchedule = structuredClone(sampleSchedule);
  const statuses = ["complete", "planned", "in_progress", "blocked"] as const;
  boardSchedule.tasks = boardSchedule.tasks.map((task, index) => ({ ...task, status: statuses[index] }));
  boardSchedule.capabilities = reviewOnly;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const taskUpdates: unknown[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installMockApi(page, [], [], taskUpdates, [], boardSchedule);
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: reviewOnly }));
  await page.route(`/api/planning/projects/${sampleProject.id}/schedule`, (route) => route.fulfill({
    json: boardSchedule,
    headers: { ETag: proofEtag(1) },
  }));

  await openPlanning(page);
  await page.getByRole("combobox", { name: "Planning view", exact: true }).selectOption("Board");
  const board = page.getByRole("region", { name: "Planning flow board", exact: true });
  await expect(board).toBeVisible();
  await expect(board.getByRole("region")).toHaveCount(4);
  await expect(board.getByRole("combobox", { name: /^Move task / })).toHaveCount(0);
  await expect(board.getByRole("button", { name: /^More actions for / })).toHaveCount(0);
  await expect(board.getByRole("button", { name: /^Edit Task title for / })).toHaveCount(0);

  const openTask = board.getByRole("button", { name: "Open task Define schedule scope", exact: true });
  await expect(openTask).toBeEnabled();
  const taskCard = board.locator('article[data-planning-task-id="task-1"]');
  await expect(taskCard).toHaveAttribute("draggable", "false");
  await taskCard.getByText("Define schedule scope", { exact: true }).click();
  const inspector = page.getByRole("dialog", { name: "Planning inspector", exact: true });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Save task", exact: true })).toBeDisabled();
  await inspector.getByRole("button", { name: "Close Planning inspector", exact: true }).click();
  await expect(inspector).toBeHidden();
  await expect(openTask).toBeFocused();
  expect(taskUpdates).toEqual([]);
  await expect.poll(() => consoleErrors).toEqual([]);
  await expect.poll(() => pageErrors).toEqual([]);
});
