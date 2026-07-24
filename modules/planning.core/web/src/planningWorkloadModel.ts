import { dateValue, isoDate } from "./planningGanttModel";
import type { PlanningSchedule } from "./types";

export type PlanningWorkloadDay = {
  allocation: number;
  capacity: number;
  date: string;
  overallocated: boolean;
  taskTitles: string[];
};

export type PlanningResourceWorkload = {
  days: PlanningWorkloadDay[];
  overloadedDays: number;
  peakAllocation: number;
  resourceId: string;
  resourceName: string;
  role: string;
  taskCount: number;
  totalAssignment: number;
};

export function planningResourceWorkloads(schedule: PlanningSchedule): PlanningResourceWorkload[] {
  const taskById = new Map(schedule.tasks.map((task) => [task.id, task]));
  return schedule.resources.map((resource) => {
    const byDate = new Map<string, PlanningWorkloadDay>();
    const assignments = schedule.assignments.filter((assignment) => assignment.resource_id === resource.id);
    const taskIds = new Set<string>();
    for (const assignment of assignments) {
      const task = taskById.get(assignment.task_id);
      if (!task) continue;
      taskIds.add(task.id);
      for (const date of eachTaskDate(task.start, task.end)) {
        const day = byDate.get(date) || { allocation: 0, capacity: 100, date, overallocated: false, taskTitles: [] };
        day.allocation += assignment.allocation_percent;
        day.overallocated = day.allocation > day.capacity;
        if (!day.taskTitles.includes(task.title)) day.taskTitles.push(task.title);
        byDate.set(date, day);
      }
    }
    const serverPoints = schedule.calculation?.resource_capacity?.load_points.filter((point) => point.resource_id === resource.id) || [];
    const days = (serverPoints.length ? serverPoints.map((point) => ({
      allocation: point.allocation_percent,
      capacity: point.capacity_percent,
      date: point.date,
      overallocated: point.overallocated,
      taskTitles: point.task_ids.map((id) => taskById.get(id)?.title || id),
    })) : Array.from(byDate.values())).sort((a, b) => a.date.localeCompare(b.date));
    return {
      days,
      overloadedDays: days.filter((day) => day.overallocated).length,
      peakAllocation: Math.max(0, ...days.map((day) => day.allocation)),
      resourceId: resource.id,
      resourceName: resource.name,
      role: resource.role || "Resource",
      taskCount: taskIds.size,
      totalAssignment: assignments.reduce((sum, assignment) => sum + assignment.allocation_percent, 0),
    };
  });
}

function eachTaskDate(start: string, end: string) {
  const dates: string[] = [];
  const cursor = dateValue(start);
  const finish = dateValue(end);
  while (cursor <= finish) {
    dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
