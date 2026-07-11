import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningParticipantsPanel } from "../../web/src/PlanningParticipantsPanel";
import type { PlanningSchedule, PlanningTask } from "../../web/src/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Planning task participants", () => {
  it("selects canonical parties, assigns controlled roles, and opens ready identities", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: "party-1", display_name: "Task owner", status: "active" },
      { id: "party-2", display_name: "Approver", status: "active" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<PlanningParticipantsPanel token="token" schedule={schedule()} selectedTask={task} busy="" readOnly={false} onAdd={onAdd} onRemove={onRemove} />);

    await waitFor(() => expect(screen.getByText("2 active canonical parties available.")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Party"), { target: { value: "party-2" } });
    fireEvent.change(screen.getByLabelText("Participant role"), { target: { value: "approver" } });
    fireEvent.click(screen.getByRole("button", { name: "Add participant" }));
    expect(onAdd).toHaveBeenCalledWith("task-1", { party_id: "party-2", role: "approver" });
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/?view=contacts&party_id=party-1");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("task-1", "participant-1");
  });

  it("fails closed when participant mutations are read-only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("disabled")));
    render(<PlanningParticipantsPanel token="token" schedule={schedule()} selectedTask={task} busy="" readOnly onAdd={vi.fn()} onRemove={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Contacts is unavailable or not authorized.")).toBeTruthy());
    expect((screen.getByRole("button", { name: "Add participant" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

const task: PlanningTask = {
  id: "task-1", project_id: "project-1", version: 2, title: "Participant task", task_type: "task",
  status: "planned", start: "2026-08-03", end: "2026-08-05", duration_days: 3, progress: 0, sort_order: 1, critical: false,
};

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Participants", status: "active", start: "2026-08-03", end: "2026-08-28", target_finish: "2026-08-28", calculated_finish: "2026-08-28", revision: 2 },
    tasks: [task], dependencies: [], resources: [], assignments: [], links: [], baselines: [],
    participants: [{
      id: "participant-1", project_id: "project-1", task_id: "task-1", role: "owner", source_module: "contacts.core",
      party: { id: "party-1", resolver: "contacts.party", resolver_version: "1" },
      resolution: { status: "ready", display_label: "Task owner", status_summary: "Party is active.", checked_at: "2026-08-03T00:00:00Z", open_path: "/?view=contacts&party_id=party-1" },
      created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
    }],
    validation: { ok: true, violations: [] },
  };
}
