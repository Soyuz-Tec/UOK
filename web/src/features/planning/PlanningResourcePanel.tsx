import { Save, UserPlus } from "lucide-react";
import { useState } from "react";

import { CommandButton } from "../../shared/primitives";
import type { PlanningAssignmentCreateRequest, PlanningResourceCreateRequest } from "./planningContracts";
import type { PlanningSchedule, PlanningTask } from "./types";

export function PlanningResourcePanel({ schedule, selectedTask, busy, onCreateResource, onAssignResource }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  onCreateResource: (payload: PlanningResourceCreateRequest) => Promise<void>;
  onAssignResource: (payload: PlanningAssignmentCreateRequest) => Promise<void>;
}) {
  const [resource, setResource] = useState({ name: "", role: "" });
  const [assignment, setAssignment] = useState({ resource_id: "", allocation_percent: "100" });
  return (
    <section className="planning-editor" aria-label="Resource assignments">
      <h3>Resources</h3>
      <div className="planning-form-grid">
        <label className="field"><span>Name</span><input value={resource.name} onChange={(event) => setResource({ ...resource, name: event.target.value })} /></label>
        <label className="field"><span>Role</span><input value={resource.role} onChange={(event) => setResource({ ...resource, role: event.target.value })} /></label>
      </div>
      <CommandButton icon={UserPlus} loading={busy === "resource"} onClick={() => onCreateResource(resource)}>Add resource</CommandButton>
      <div className="planning-form-grid">
        <label className="field"><span>Assign</span><select value={assignment.resource_id} onChange={(event) => setAssignment({ ...assignment, resource_id: event.target.value })}>
          <option value="">Select resource</option>
          {schedule.resources.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        <label className="field"><span>Allocation</span><input type="number" min="1" max="300" value={assignment.allocation_percent} onChange={(event) => setAssignment({ ...assignment, allocation_percent: event.target.value })} /></label>
      </div>
      <CommandButton icon={Save} disabled={!selectedTask} loading={busy === "resource"} onClick={() => selectedTask && onAssignResource({ task_id: selectedTask.id, resource_id: assignment.resource_id, allocation_percent: Number(assignment.allocation_percent) })}>
        Assign selected
      </CommandButton>
    </section>
  );
}
