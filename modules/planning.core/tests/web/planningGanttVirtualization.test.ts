import { act, renderHook } from "@testing-library/react";
import { createRef, type UIEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { planningVirtualWindow, planningVirtualizationThreshold, usePlanningGanttVirtualization } from "../../web/src/planningGanttVirtualization";

const layouts = Array.from({ length: 500 }, (_, index) => ({ taskId: `task-${index}`, top: index * 48, height: 48 }));

afterEach(() => vi.unstubAllGlobals());

describe("planning Gantt virtualization", () => {
  it("keeps small schedules fully rendered", () => {
    const small = layouts.slice(0, planningVirtualizationThreshold);
    expect(planningVirtualWindow(small, 4_000, 640)).toEqual({ start: 0, end: small.length });
  });

  it("returns an overscanned window for large schedules", () => {
    const first = planningVirtualWindow(layouts, 0, 640);
    const middle = planningVirtualWindow(layouts, 12_000, 640);
    const last = planningVirtualWindow(layouts, 24_000, 640);

    expect(first.start).toBe(0);
    expect(first.end).toBeLessThan(40);
    expect(middle.start).toBeGreaterThan(200);
    expect(middle.end - middle.start).toBeLessThan(40);
    expect(last.end).toBe(500);
  });

  it("does not pull manual scrolling back to an unchanged selected task", () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() { return undefined; }
      disconnect() { return undefined; }
    });
    const grid = document.createElement("div");
    const chart = document.createElement("div");
    const gridRef = createRef<HTMLDivElement>();
    const chartRef = createRef<HTMLDivElement>();
    gridRef.current = grid;
    chartRef.current = chart;
    const { result } = renderHook(() => usePlanningGanttVirtualization(layouts, "task-0", gridRef, chartRef));

    act(() => {
      chart.scrollTop = 12_000;
      result.current.onChartScroll({ currentTarget: chart } as UIEvent<HTMLDivElement>);
    });

    expect(chart.scrollTop).toBe(12_000);
    expect(grid.scrollTop).toBe(12_000);
    expect(result.current.start).toBeGreaterThan(200);
  });

  it("uses the visible timeline position when the timeline-only grid is hidden", () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() { return undefined; }
      disconnect() { return undefined; }
    });
    const grid = document.createElement("div");
    const chart = document.createElement("div");
    const gridRef = createRef<HTMLDivElement>();
    const chartRef = createRef<HTMLDivElement>();
    gridRef.current = grid;
    chartRef.current = chart;
    const { rerender } = renderHook(
      ({ selectedTaskId }) => usePlanningGanttVirtualization(layouts, selectedTaskId, gridRef, chartRef),
      { initialProps: { selectedTaskId: "task-0" } },
    );

    chart.scrollTop = 12_000;
    grid.scrollTop = 0;
    rerender({ selectedTaskId: "task-250" });

    expect(chart.scrollTop).toBe(12_000);
  });
});
