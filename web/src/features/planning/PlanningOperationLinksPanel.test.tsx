import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningOperationLinksPanel } from "./PlanningOperationLinksPanel";
import type { PlanningLink, PlanningSchedule, PlanningTask } from "./types";

afterEach(cleanup);

describe("Planning operation links", () => {
  it("creates a typed selected-task link and exposes only ready jump targets", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<PlanningOperationLinksPanel schedule={schedule()} selectedTask={task} busy="" readOnly={false} onCreate={onCreate} onRemove={onRemove} />);

    expect(screen.getAllByRole("link", { name: "Open" })[0].getAttribute("href")).toBe("/?view=contacts&party_id=party-1");
    expect(screen.getByText(/operation provider is unavailable/i)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Open" })[1].getAttribute("href")).toBe("/?view=communications&thread_id=thread-1");

    fireEvent.change(screen.getByLabelText("Target type"), { target: { value: "document" } });
    fireEvent.change(screen.getByLabelText("Relationship"), { target: { value: "requires" } });
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: "artifact-2" } });
    fireEvent.click(screen.getByLabelText("Blocks readiness"));
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreate).toHaveBeenCalledWith({
      scope_type: "task",
      task_id: "task-1",
      relationship: "requires",
      blocking: true,
      target: { kind: "document", id: "artifact-2" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(onRemove).toHaveBeenCalledWith("link-party");
  });

  it("disables link mutations when the server link capability is absent", () => {
    render(<PlanningOperationLinksPanel schedule={schedule()} selectedTask={task} busy="" readOnly onCreate={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText("The server has not granted Planning link authority.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add link" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: "Remove" })[0] as HTMLButtonElement).disabled).toBe(true);
  });
});

const task: PlanningTask = {
  id: "task-1", project_id: "project-1", version: 1, title: "Evidence gate", task_type: "milestone",
  status: "planned", start: "2026-08-03", end: "2026-08-03", duration_days: 0,
  progress: 0, sort_order: 1, critical: true,
};

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Operation", status: "active", start: "2026-08-03", end: "2026-08-28", revision: 4 },
    tasks: [task], dependencies: [], resources: [], assignments: [], baselines: [],
    links: [
      link("link-party", "party", "party-1", "ready", "Responsible owner", "Party is active.", "/?view=contacts&party_id=party-1"),
      link("link-operation", "operation", "operation-1", "unavailable", null, "Operation provider is unavailable.", null),
      link("link-thread", "communication_thread", "thread-1", "ready", "Task control room", "Communication thread is open.", "/?view=communications&thread_id=thread-1"),
    ],
    validation: { ok: true, violations: [] },
  };
}

function link(id: string, kind: PlanningLink["target"]["kind"], targetId: string, status: PlanningLink["resolution"]["status"], label: string | null, summary: string, openPath: string | null): PlanningLink {
  return {
    id, project_id: "project-1", task_id: "task-1", scope_type: "task", relationship: "owned_by", blocking: false,
    target: { kind, id: targetId, resolver: `${kind}.resolver`, resolver_version: "1" },
    resolution: { status, display_label: label, status_summary: summary, checked_at: "2026-08-03T00:00:00Z", open_path: openPath },
    created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
  };
}
