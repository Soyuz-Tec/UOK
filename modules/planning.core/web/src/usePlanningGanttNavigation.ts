import { useEffect, useRef, type RefObject } from "react";

import { planningScheduleHorizon, xForDate, type TimelineScale } from "./planningGanttModel";
import { dateScrollLeft, projectRangeScrollLeft, selectedTaskScrollLeft } from "./planningTimelineNavigation";
import type { PlanningSchedule, PlanningTask } from "./types";

export function usePlanningGanttNavigation({
  cellWidth,
  chartStart,
  dateTarget,
  dateTargetSignal,
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
  dateTarget: string;
  dateTargetSignal: number;
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
  const projectStart = schedule.project.start;
  const projectHorizon = planningScheduleHorizon(schedule);
  const lastFitProjectSignal = useRef(0);

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
    if (!fitProjectSignal || fitProjectSignal === lastFitProjectSignal.current || !scrollRef.current) return;
    lastFitProjectSignal.current = fitProjectSignal;
    scrollRef.current.scrollTo({
      left: projectRangeScrollLeft(projectStart, projectHorizon, chartStart, scale, cellWidth, scrollRef.current.clientWidth),
      behavior: "smooth",
    });
  }, [cellWidth, chartStart, fitProjectSignal, projectHorizon, projectStart, scale, scrollRef]);

  useEffect(() => {
    if (!dateTargetSignal || !dateTarget || !scrollRef.current) return;
    scrollRef.current.scrollTo({ left: dateScrollLeft(dateTarget, chartStart, scale, cellWidth, scrollRef.current.clientWidth), behavior: "smooth" });
  }, [cellWidth, chartStart, dateTarget, dateTargetSignal, scale, scrollRef]);
}
