import { CalendarDays, CheckCircle2, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import type { PlanningTask, PlanningTaskStatus } from "./types";
import type { PlanningTaskUpdateRequest } from "./planningContracts";

export type PlanningBulkTaskUpdate = {
  taskId: string;
  payload: PlanningTaskUpdateRequest;
};

export function PlanningBulkEditControls({
  busy,
  disabled,
  selectedTasks,
  onBulkTaskEdit,
}: {
  busy: boolean;
  disabled: boolean;
  selectedTasks: PlanningTask[];
  onBulkTaskEdit: (updates: PlanningBulkTaskUpdate[]) => void;
}) {
  const [status, setStatus] = useState<PlanningTaskStatus>("in_progress");
  const [progress, setProgress] = useState(50);
  const [shiftDays, setShiftDays] = useState(1);
  const orderedDateShiftTasks = useMemo(() => {
    const direction = shiftDays >= 0 ? -1 : 1;
    return [...selectedTasks].sort((a, b) => direction * (dateValue(a.start) - dateValue(b.start) || a.sort_order - b.sort_order));
  }, [selectedTasks, shiftDays]);
  const hasSelection = selectedTasks.length > 0;
  const blocked = disabled || busy || !hasSelection;

  return (
    <>
      <CommandButton icon={CheckCircle2} onClick={() => applySamePayload({ status: "complete", progress: 100 })} loading={busy} disabled={blocked}>
        Complete selected
      </CommandButton>
      <label className="planning-toolbar-select">
        <ListChecks size={16} aria-hidden="true" />
        <span>Bulk status</span>
        <select aria-label="Bulk status" value={status} disabled={blocked} onChange={(event) => setStatus(event.target.value as PlanningTaskStatus)}>
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="complete">Complete</option>
        </select>
      </label>
      <label className="planning-toolbar-select">
        <span>Progress</span>
        <input aria-label="Bulk progress" type="number" min="0" max="100" value={progress} disabled={blocked} onChange={(event) => setProgress(clampProgress(event.target.value))} />
      </label>
      <CommandButton icon={ListChecks} onClick={() => applySamePayload({ status, progress })} loading={busy} disabled={blocked}>
        Apply bulk
      </CommandButton>
      <label className="planning-toolbar-select">
        <CalendarDays size={16} aria-hidden="true" />
        <span>Shift days</span>
        <input aria-label="Bulk shift days" type="number" min="-30" max="30" value={shiftDays} disabled={blocked} onChange={(event) => setShiftDays(clampShift(event.target.value))} />
      </label>
      <CommandButton icon={CalendarDays} onClick={applyDateShift} loading={busy} disabled={blocked || shiftDays === 0}>
        Shift dates
      </CommandButton>
    </>
  );

  function applySamePayload(payload: PlanningTaskUpdateRequest) {
    onBulkTaskEdit(selectedTasks.map((task) => ({ taskId: task.id, payload })));
  }

  function applyDateShift() {
    onBulkTaskEdit(orderedDateShiftTasks.map((task) => ({
      taskId: task.id,
      payload: { start: shiftDate(task.start, shiftDays), end: shiftDate(task.end, shiftDays), cascade: false },
    })));
  }
}

function clampProgress(value: string) {
  return Math.max(0, Math.min(100, Number.parseInt(value || "0", 10)));
}

function clampShift(value: string) {
  return Math.max(-30, Math.min(30, Number.parseInt(value || "0", 10)));
}

function dateValue(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
