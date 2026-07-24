import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningScheduleList } from "../../web/src/PlanningScheduleList";
import { planningSchedule } from "./planningFlowBoardFixtures";

afterEach(cleanup);

describe("PlanningScheduleList", () => {
  it("uses the shared grid with an explicit keyboard-safe Open control", () => {
    const onTaskOpen = vi.fn();
    const schedule = planningSchedule();
    schedule.tasks[0] = { ...schedule.tasks[0], title: "Scope نطاق", wbs: "WBS-١" };
    const { container } = render(<PlanningScheduleList schedule={schedule} onTaskOpen={onTaskOpen} />);

    expect(screen.getByRole("grid", { name: "Planning task list" })).toBeInTheDocument();
    expect(container.querySelector("tbody tr[data-clickable='true']")).toBeNull();
    expect(screen.getByText("Scope نطاق")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("WBS-١")).toHaveAttribute("dir", "auto");
    fireEvent.click(screen.getByRole("button", { name: "Open task Scope نطاق" }));
    expect(onTaskOpen).toHaveBeenCalledWith("scope");
  });
});
