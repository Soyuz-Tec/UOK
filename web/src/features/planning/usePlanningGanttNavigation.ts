import { useEffect, type RefObject } from "react";

import { xForDate, type TimelineScale } from "./planningGanttModel";
import { projectRangeScrollLeft, selectedTaskScrollLeft } from "./planningTimelineNavigation";
import type { PlanningSchedule, PlanningTask } from "./types";

export function usePlanningGanttNavigation({
  cellWidth,
  chartStart,
  fitProjectSignal,
  rowRefs,
  scale,
  schedule,
  scrollRef,
  selectedTaskId,
  selectedTaskSignal,
  todaySignal,
  visibleTasks,
}: {
  cellWidth: number;
  chartStart: Date;
  fitProjectSignal: number;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
  scale: TimelineScale;
  schedule: PlanningSchedule;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedTaskId: string;
  selectedTaskSignal: number;
  todaySignal: number;
  visibleTasks: PlanningTask[];
}) {
  useEffect(() => {
    if (!todaySignal || !scrollRef.current) return;
    const todayX = xForDate(new Date(), chartStart, scale, cellWidth);
    scrollRef.current.scrollTo({ left: Math.max(0, todayX - scrollRef.current.clientWidth / 2), behavior: "smooth" });
  }, [cellWidth, chartStart, scale, scrollRef, todaySignal]);

  useEffect(() => {
    if (!selectedTaskSignal || !selectedTaskId || !scrollRef.current) return;
    const task = visibleTasks.find((row) => row.id === selectedTaskId);
    if (!task) return;
    scrollRef.current.scrollTo({ left: selectedTaskScrollLeft(task, chartStart, scale, cellWidth, scrollRef.current.clientWidth), behavior: "smooth" });
    rowRefs.current.get(task.id)?.focus();
  }, [cellWidth, chartStart, rowRefs, scale, scrollRef, selectedTaskId, selectedTaskSignal, visibleTasks]);

  useEffect(() => {
    if (!fitProjectSignal || !scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: projectRangeScrollLeft(schedule.project.start, schedule.project.end, chartStart, scale, cellWidth, scrollRef.current.clientWidth),
      behavior: "smooth",
    });
  }, [cellWidth, chartStart, fitProjectSignal, scale, schedule.project.end, schedule.project.start, scrollRef]);
}
