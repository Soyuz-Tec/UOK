import { describe, expect, it } from "vitest";

import {
  statusCodeWidth,
  taskOverlayGeometry,
  taskTooltipHeight,
  taskTooltipWidth,
} from "../../web/src/PlanningGanttTaskOverlays";

describe("Planning Gantt task overlay geometry", () => {
  it("reserves separate narrow-bar regions for the label, status, handle, and tooltip", () => {
    const indicatorWidth = statusCodeWidth("CRIT");
    const geometry = taskOverlayGeometry({
      barWidth: 52,
      barX: 100,
      hasHandles: true,
      headerHeight: 54,
      indicatorWidth,
      rowSize: 50,
      rowTop: 0,
      timelineWidth: 800,
    });

    expect(geometry).toMatchObject({
      indicatorX: 158,
      indicatorRight: 198,
      labelX: 108,
      labelWidth: 40,
      sourceHandleX: 210,
      tooltipX: 223,
      tooltipY: 62,
    });
    expect(geometry.labelX + geometry.labelWidth).toBeLessThan(geometry.indicatorX);
    expect(geometry.indicatorRight).toBeLessThan(geometry.sourceHandleX - 5);
    expect(geometry.tooltipY).toBeGreaterThanOrEqual(54);
    expect(geometry.tooltipY + taskTooltipHeight).toBeLessThanOrEqual(104);
    expect(geometry.tooltipX + taskTooltipWidth).toBeLessThanOrEqual(800);
  });

  it("keeps a wide task label and status inside the bar while placing its controls outside", () => {
    const indicatorWidth = statusCodeWidth("CRIT");
    const geometry = taskOverlayGeometry({
      barWidth: 1_040,
      barX: 100,
      hasHandles: true,
      headerHeight: 54,
      indicatorWidth,
      rowSize: 50,
      rowTop: 50,
      timelineWidth: 2_000,
    });

    expect(geometry.indicatorX).toBe(1_095);
    expect(geometry.indicatorRight).toBeLessThan(1_140);
    expect(geometry.labelWidth).toBe(240);
    expect(geometry.labelX + geometry.labelWidth).toBeLessThan(geometry.indicatorX);
    expect(geometry.sourceHandleX).toBe(1_152);
    expect(geometry.tooltipY).toBe(112);
  });

  it("moves an internal status code outside when it would cover the progress handle", () => {
    const geometry = taskOverlayGeometry({
      barWidth: 120,
      barX: 100,
      hasHandles: true,
      headerHeight: 54,
      indicatorWidth: statusCodeWidth("CRIT"),
      progressHandleX: 196,
      rowSize: 50,
      rowTop: 0,
      timelineWidth: 500,
    });

    expect(geometry.indicatorX).toBe(226);
    expect(196 + 5).toBeLessThan(geometry.indicatorX);
  });

  it("keeps horizon-edge controls inside the trailing overlay gutter", () => {
    const timelineWidth = 224;
    const geometry = taskOverlayGeometry({
      barWidth: 52,
      barX: 100,
      hasHandles: true,
      headerHeight: 54,
      indicatorWidth: statusCodeWidth("CRIT"),
      rowSize: 50,
      rowTop: 0,
      timelineWidth,
    });

    expect(geometry.sourceHandleX + 5).toBeLessThanOrEqual(timelineWidth - 4);
  });

  it("bounds tooltips to the visible horizontal scroll window", () => {
    const geometry = taskOverlayGeometry({
      barWidth: 52,
      barX: 1_300,
      hasHandles: true,
      headerHeight: 54,
      indicatorWidth: statusCodeWidth("CRIT"),
      rowSize: 50,
      rowTop: 0,
      timelineWidth: 2_000,
      viewportLeft: 900,
      viewportWidth: 500,
    });

    expect(geometry.tooltipX).toBe(1_068);
    expect(geometry.tooltipX).toBeGreaterThanOrEqual(904);
    expect(geometry.tooltipX + taskTooltipWidth).toBeLessThanOrEqual(1_396);
  });
});
