import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanningSchedule } from "./types";
import { usePlanningGanttNavigation } from "./usePlanningGanttNavigation";

afterEach(cleanup);

describe("Planning Gantt navigation", () => {
  it("fits once per signal instead of refitting on schedule refreshes", () => {
    const scrollTo = vi.fn();
    const initial = schedule("2026-08-31");
    const { rerender } = render(<Harness schedule={initial} fitProjectSignal={1} scrollTo={scrollTo} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    rerender(<Harness schedule={schedule("2026-09-15")} fitProjectSignal={1} scrollTo={scrollTo} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    rerender(<Harness schedule={schedule("2026-09-15")} fitProjectSignal={2} scrollTo={scrollTo} />);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});

function Harness({ schedule, fitProjectSignal, scrollTo }: { schedule: PlanningSchedule; fitProjectSignal: number; scrollTo: ReturnType<typeof vi.fn> }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  usePlanningGanttNavigation({
    cellWidth: 24,
    chartStart,
    dateTarget: "",
    dateTargetSignal: 0,
    fitProjectSignal,
    rowRefs,
    scale: "day",
    schedule,
    scrollRef,
    selectedTaskId: "",
    selectedTaskSignal: 0,
    todaySignal: 0,
    visibleTasks: schedule.tasks,
  });
  return <div ref={(node) => {
    scrollRef.current = node;
    if (!node) return;
    Object.defineProperty(node, "clientWidth", { configurable: true, value: 320 });
    node.scrollTo = scrollTo as unknown as HTMLDivElement["scrollTo"];
  }} />;
}

function schedule(calculatedFinish: string): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Navigation", status: "active", start: "2026-08-01", end: "2026-08-31", target_finish: "2026-08-31", calculated_finish: calculatedFinish, revision: 1 },
    tasks: [], dependencies: [], resources: [], assignments: [], links: [], baselines: [],
    validation: { ok: true, violations: [], warnings: [] },
  };
}

const chartStart = new Date("2026-08-01T00:00:00");
