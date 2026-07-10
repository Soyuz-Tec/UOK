import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningTaskDateFields } from "./PlanningTaskDateFields";
import type { PlanningTask } from "./types";

afterEach(cleanup);

describe("Planning task date semantics", () => {
  it("requires a reason for actual facts and submits explicit nullable date families", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PlanningTaskDateFields task={task} timezone="America/New_York" busy={false} onSave={onSave} />);

    expect(screen.getByText(/hour and minute zoom are visual only/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Actual start"), { target: { value: "2026-03-07" } });
    expect((screen.getByRole("button", { name: "Save execution dates" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Actual-date reason"), { target: { value: "Observed operating start" } });
    fireEvent.click(screen.getByRole("button", { name: "Save execution dates" }));

    expect(onSave).toHaveBeenCalledWith({
      forecast_start: "2026-03-08",
      forecast_end: "2026-03-10",
      actual_start: "2026-03-07",
      actual_end: null,
      deadline: "2026-03-09",
      reason: "Observed operating start",
    });
  });

  it("allows forecast changes without an actual-date reason", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PlanningTaskDateFields task={task} timezone="UTC" busy={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Forecast end"), { target: { value: "2026-03-11" } });
    expect((screen.getByRole("button", { name: "Save execution dates" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

const task: PlanningTask = {
  id: "task-1", project_id: "project-1", version: 1, title: "Observe execution", task_type: "task",
  status: "in_progress", start: "2026-03-06", end: "2026-03-10", planned_start: "2026-03-06", planned_end: "2026-03-10",
  forecast_start: "2026-03-08", forecast_end: "2026-03-10", actual_start: null, actual_end: null, deadline: "2026-03-09",
  forecast_start_variance_days: 2, forecast_end_variance_days: 0, deadline_variance_days: 1,
  duration_days: 3, progress: 25, sort_order: 1, critical: false,
};
