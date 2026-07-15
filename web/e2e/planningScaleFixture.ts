import type { Page } from "@playwright/test";

const project = { id: "scale-project", name: "500 task scale proof", status: "active", start: "2027-01-04", end: "2028-12-31", target_finish: "2028-12-31", calculated_finish: "2028-12-31", timezone: "UTC", revision: 1 };
const capabilities = { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, analyze: true, analysis_approve: true, review_only: false };
const tasks = Array.from({ length: 500 }, (_, index) => ({
  id: `scale-task-${index + 1}`, project_id: project.id, version: 1, parent_task_id: null, wbs: String(index + 1), title: `Scale task ${index + 1}`,
  task_type: "task", status: "planned", start: "2027-01-04", end: "2027-01-04", duration_days: 1, progress: index % 100, sort_order: index,
  critical: index < 20, total_slack_days: index < 20 ? 0 : 5,
  readiness: { ready: true, required_count: 0, blocking_count: 0, blocking_requirement_ids: [] },
}));
const dependencyPairs = [
  ...Array.from({ length: 499 }, (_, index) => [index, index + 1]),
  ...Array.from({ length: 301 }, (_, index) => [index, index + 2]),
];
const schedule = {
  project, capabilities, tasks,
  task_flow: {
    schema_version: 1 as const,
    statuses: [
      { status: "planned" as const, display_label: "Planned", allowed_transitions: ["in_progress" as const, "blocked" as const, "complete" as const] },
      { status: "in_progress" as const, display_label: "In progress", allowed_transitions: ["planned" as const, "blocked" as const, "complete" as const] },
      { status: "blocked" as const, display_label: "Blocked", allowed_transitions: ["planned" as const, "in_progress" as const, "complete" as const] },
      { status: "complete" as const, display_label: "Complete", allowed_transitions: ["planned" as const, "in_progress" as const] },
    ],
  },
  dependencies: dependencyPairs.map(([source, target], index) => ({
    id: `scale-dependency-${index + 1}`, project_id: project.id,
    predecessor_task_id: tasks[source].id, successor_task_id: tasks[target].id, dependency_type: "start_to_start", lag_days: 0,
  })),
  calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
  availability: { source_module: "calendar.core", scope: "project", status: "ready", from: project.start, to: project.end, warnings: [], busy: [], events: [] },
  resources: [], assignments: [], links: [], participants: [], requirements: [],
  readiness: { ready: true, required_count: 0, blocking_count: 0, blocking_requirement_ids: [], task_blocker_count: 0 },
  baselines: [], validation: { ok: true, violations: [], warnings: [] },
};

export const ganttLayoutSchedule = {
  ...schedule,
  tasks: [
    {
      ...tasks[0],
      title: "One-day critical task with a long title",
      status: "in_progress",
      progress: 45,
      deadline: "2027-01-04",
      baseline_start: "2027-01-04",
      baseline_end: "2027-01-04",
      start_variance_days: 0,
      end_variance_days: 0,
    },
    {
      ...tasks[1],
      title: "Twenty-day integrated Gantt task",
      status: "in_progress",
      start: "2027-01-05",
      end: "2027-01-24",
      duration_days: 20,
      progress: 15,
      baseline_start: "2027-01-05",
      baseline_end: "2027-01-24",
      start_variance_days: 0,
      end_variance_days: 0,
    },
  ],
  dependencies: [{
    id: "layout-dependency-1",
    project_id: project.id,
    predecessor_task_id: tasks[0].id,
    successor_task_id: tasks[1].id,
    dependency_type: "finish_to_start",
    lag_days: 0,
  }],
};

export async function installScaleApi(page: Page, taskCount = 500, scheduleOverride: typeof ganttLayoutSchedule | null = null) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("uok_token", "scale-proof-token");
    window.localStorage.setItem("uok_user", JSON.stringify({ username: "admin", display_name: "UOK Admin", email: "admin@example.test", role: "platform_admin" }));
    (window as Window & { uokLongTasks?: number[] }).uokLongTasks = [];
    new PerformanceObserver((list) => {
      const target = window as Window & { uokLongTasks?: number[] };
      target.uokLongTasks?.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  const base = {
    version: "3.1.0-alpha.3", maturity: "runtime_proven", installable: true,
    uninstallable: true, updatable: true, maintainable: true, required: false,
    recorded_status: null, reconciliation_required: false,
    lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
    lifecycle_state_declared: true, dependencies: [], dependents: [],
  };
  const modules = {
    "apps.manager": { ...base, name: "apps.manager", status: "installed", recorded_status: "installed", kind: "control_module", required: true, uninstallable: false, lifecycle: ["installed", "upgraded"] },
    "communications.core": { ...base, name: "communications.core", status: "installed", recorded_status: "installed", kind: "capability_module" },
    "planning.core": { ...base, name: "planning.core", status: "installed", recorded_status: "installed", kind: "capability_module" },
  };
  const proofSchedule = scheduleOverride || (taskCount === 500 ? schedule : { ...schedule, tasks: tasks.slice(0, taskCount), dependencies: schedule.dependencies.filter((dependency) => Number(dependency.successor_task_id.split("-").at(-1)) <= taskCount) });
  const visibleTaskCount = proofSchedule.tasks.length;
  await page.route("/api/dashboard", (route) => route.fulfill({ json: { counts: { planning_projects: 1, planning_tasks: visibleTaskCount } } }));
  await page.route("/api/baseline-evidence", (route) => route.fulfill({ json: { ok: true, checks: { planning_ui_proof: true } } }));
  await page.route("/api/architecture/alignment", (route) => route.fulfill({ json: { ok: true, checks: { module_neutral_baseline: true } } }));
  await page.route("/api/modules/catalog", (route) => route.fulfill({ json: { modules } }));
  await page.route("/api/planning/capabilities", (route) => route.fulfill({ json: capabilities }));
  await page.route("/api/planning/projects", (route) => route.fulfill({ json: [project] }));
  await page.route(`/api/planning/projects/${project.id}/schedule`, (route) => route.fulfill({ json: proofSchedule, headers: { ETag: `"planning-r1-sha256-${"a".repeat(64)}"` } }));
}
