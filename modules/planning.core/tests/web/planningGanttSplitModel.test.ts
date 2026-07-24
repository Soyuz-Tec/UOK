import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLANNING_SPLIT_PERCENT,
  MAX_PLANNING_SPLIT_PERCENT,
  MIN_PLANNING_SPLIT_PERCENT,
  clampPlanningSplitPercent,
  fitPlanningSplitPercentToContainer,
  planningSplitBoundsForContainer,
  planningSplitKeyCommand,
  planningSplitPercentFromPointer,
  readPlanningSplitPercent,
  writePlanningSplitPercent,
} from "../../web/src/planningGanttSplitModel";

describe("Planning Gantt split model", () => {
  it("clamps pointer positions to the supported grid range", () => {
    expect(planningSplitPercentFromPointer(500, 100, 1000)).toBe(40);
    expect(planningSplitPercentFromPointer(-100, 100, 1000)).toBe(34);
    expect(planningSplitPercentFromPointer(2000, 100, 1000)).toBe(58);
    expect(planningSplitPercentFromPointer(700, 100, 1000, true)).toBe(40);
  });

  it("fits the split to both pane minimums without overflowing the container", () => {
    expect(planningSplitBoundsForContainer(1000)).toEqual({ min: 34, max: 58 });
    expect(fitPlanningSplitPercentToContainer(MIN_PLANNING_SPLIT_PERCENT, 1000)).toBe(34);
    expect(fitPlanningSplitPercentToContainer(MAX_PLANNING_SPLIT_PERCENT, 1000)).toBe(58);
    expect(planningSplitBoundsForContainer(2000)).toEqual({ min: 24, max: 68 });
    expect(fitPlanningSplitPercentToContainer(42, 760)).toBe(44.7);
  });

  it("supports physical arrow movement in both directions and bounded Home/End commands", () => {
    expect(planningSplitKeyCommand(42, "ArrowRight").value).toBe(43);
    expect(planningSplitKeyCommand(42, "ArrowLeft", true).value).toBe(37);
    expect(planningSplitKeyCommand(42, "ArrowLeft", false, true).value).toBe(43);
    expect(planningSplitKeyCommand(42, "Home").value).toBe(MIN_PLANNING_SPLIT_PERCENT);
    expect(planningSplitKeyCommand(42, "End").value).toBe(MAX_PLANNING_SPLIT_PERCENT);
    expect(planningSplitKeyCommand(42, "Escape")).toEqual({ handled: false, value: 42 });
    expect(planningSplitKeyCommand(24, "ArrowRight", false, false, 1000).value).toBe(35);
    expect(planningSplitKeyCommand(68, "Home", false, false, 1000).value).toBe(34);
    expect(planningSplitKeyCommand(24, "End", false, false, 1000).value).toBe(58);
  });

  it("persists a clamped split for each project and field preset", () => {
    window.localStorage.clear();
    expect(readPlanningSplitPercent("project-1", "core")).toBe(DEFAULT_PLANNING_SPLIT_PERCENT);
    expect(writePlanningSplitPercent("project-1", "core", 80)).toBe(MAX_PLANNING_SPLIT_PERCENT);
    expect(readPlanningSplitPercent("project-1", "core")).toBe(MAX_PLANNING_SPLIT_PERCENT);
    expect(readPlanningSplitPercent("project-1", "progress")).toBe(DEFAULT_PLANNING_SPLIT_PERCENT);
    expect(clampPlanningSplitPercent(Number.NaN)).toBe(DEFAULT_PLANNING_SPLIT_PERCENT);
  });
});
