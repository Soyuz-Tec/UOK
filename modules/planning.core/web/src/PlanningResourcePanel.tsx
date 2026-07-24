import { CalendarDays, Save, UserPlus } from "lucide-react";
import { useState } from "react";

import { CommandButton } from "@uok/shared/primitives";
import type { PlanningAssignmentCreateRequest, PlanningResourceCalendarUpdateRequest, PlanningResourceCreateRequest } from "./planningContracts";
import type { PlanningCapacityUnit, PlanningResourceType, PlanningSchedule, PlanningTask } from "./types";

const RESOURCE_TYPES: Array<{ value: PlanningResourceType; label: string }> = [
  { value: "human", label: "Person" }, { value: "team", label: "Team" },
  { value: "vehicle", label: "Vehicle" }, { value: "equipment", label: "Equipment" },
  { value: "material", label: "Material" }, { value: "budget", label: "Budget" },
  { value: "time_window", label: "Time window" }, { value: "document", label: "Document" },
  { value: "location", label: "Location" }, { value: "asset", label: "Asset" },
  { value: "custom", label: "Custom" },
];
const RESOURCE_UNITS: Record<PlanningResourceType, PlanningCapacityUnit[]> = {
  human: ["fte", "hours_per_day", "percent"], team: ["fte", "people", "hours_per_day", "percent"],
  vehicle: ["units", "hours_per_day", "percent"], equipment: ["units", "hours_per_day", "percent"],
  material: ["units", "kg", "tonnes", "liters"], budget: ["currency"],
  time_window: ["hours_per_day", "percent"], document: ["units", "hours_per_day", "percent"],
  location: ["units", "hours_per_day", "percent"], asset: ["units", "hours_per_day", "percent"],
  custom: ["units", "hours_per_day", "percent"],
};
const CANONICAL_KINDS: Record<PlanningResourceType, Array<{ value: string; label: string }>> = {
  human: [{ value: "party", label: "Party" }], team: [{ value: "party", label: "Party" }],
  vehicle: [{ value: "asset", label: "Asset" }], equipment: [{ value: "asset", label: "Asset" }],
  material: [{ value: "asset", label: "Asset" }], budget: [{ value: "agreement", label: "Agreement" }],
  time_window: [{ value: "calendar_event", label: "Calendar event" }], document: [{ value: "document", label: "Document" }],
  location: [{ value: "location", label: "Location" }], asset: [{ value: "asset", label: "Asset" }],
  custom: [{ value: "party", label: "Party" }, { value: "document", label: "Document" }, { value: "location", label: "Location" }, { value: "asset", label: "Asset" }, { value: "agreement", label: "Agreement" }, { value: "calendar_event", label: "Calendar event" }],
};

export function PlanningResourcePanel({ schedule, selectedTask, busy, onCreateResource, onAssignResource, onSetResourceCalendar }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  onCreateResource: (payload: PlanningResourceCreateRequest) => Promise<void>;
  onAssignResource: (payload: PlanningAssignmentCreateRequest) => Promise<void>;
  onSetResourceCalendar: (resourceId: string, payload: PlanningResourceCalendarUpdateRequest) => Promise<void>;
}) {
  const [resource, setResource] = useState({
    name: "", role: "", resource_type: "human" as PlanningResourceType,
    capacity_value: "1", capacity_unit: "fte" as PlanningCapacityUnit,
    effective_start: "", effective_end: "", canonical_target_kind: "", canonical_target_id: "",
  });
  const [assignment, setAssignment] = useState({ resource_id: "", allocation_percent: "100" });
  const [capacityCalendar, setCapacityCalendar] = useState({
    working_days: "1,2,3,4,5", holidays: "", default_capacity_percent: "100",
    exception_start: "", exception_end: "", exception_capacity: "100", exception_reason: "",
  });
  const selectedResource = schedule.resources.find((row) => row.id === assignment.resource_id);
  return (
    <section className="planning-editor" aria-label="Resource assignments">
      <h3>Resources</h3>
      <div className="planning-form-grid">
        <label className="field"><span>Name</span><input value={resource.name} onChange={(event) => setResource({ ...resource, name: event.target.value })} /></label>
        <label className="field"><span>Role</span><input value={resource.role} onChange={(event) => setResource({ ...resource, role: event.target.value })} /></label>
        <label className="field"><span>Type</span><select value={resource.resource_type} onChange={(event) => {
          const resource_type = event.target.value as PlanningResourceType;
          setResource({ ...resource, resource_type, capacity_unit: RESOURCE_UNITS[resource_type][0], canonical_target_kind: "", canonical_target_id: "" });
        }}>{RESOURCE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Capacity</span><input type="number" min="0.001" step="0.001" value={resource.capacity_value} onChange={(event) => setResource({ ...resource, capacity_value: event.target.value })} /></label>
        <label className="field"><span>Capacity unit</span><select value={resource.capacity_unit} onChange={(event) => setResource({ ...resource, capacity_unit: event.target.value as PlanningCapacityUnit })}>
          {RESOURCE_UNITS[resource.resource_type].map((unit) => <option key={unit} value={unit}>{unit.replaceAll("_", " ")}</option>)}
        </select></label>
        <label className="field"><span>Effective start</span><input type="date" value={resource.effective_start} onChange={(event) => setResource({ ...resource, effective_start: event.target.value })} /></label>
        <label className="field"><span>Effective end</span><input type="date" value={resource.effective_end} onChange={(event) => setResource({ ...resource, effective_end: event.target.value })} /></label>
        <label className="field"><span>Canonical target type</span><select value={resource.canonical_target_kind} onChange={(event) => setResource({ ...resource, canonical_target_kind: event.target.value })}>
          <option value="">No canonical target</option>{CANONICAL_KINDS[resource.resource_type].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label className="field"><span>Canonical target ID</span><input value={resource.canonical_target_id} disabled={!resource.canonical_target_kind} onChange={(event) => setResource({ ...resource, canonical_target_id: event.target.value })} /></label>
      </div>
      <CommandButton icon={UserPlus} loading={busy === "resource"} disabled={resource.name.trim().length < 2} onClick={() => onCreateResource({
        name: resource.name, role: resource.role, resource_type: resource.resource_type,
        capacity_value: Number(resource.capacity_value), capacity_unit: resource.capacity_unit,
        effective_start: resource.effective_start || undefined, effective_end: resource.effective_end || undefined,
        canonical_target_kind: resource.canonical_target_kind as PlanningResourceCreateRequest["canonical_target_kind"] || undefined,
        canonical_target_id: resource.canonical_target_id || undefined,
      })}>Add resource</CommandButton>
      <div className="planning-form-grid">
        <label className="field"><span>Assign</span><select value={assignment.resource_id} onChange={(event) => setAssignment({ ...assignment, resource_id: event.target.value })}>
          <option value="">Select resource</option>
          {schedule.resources.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.resource_type} · {row.capacity_value} {row.capacity_unit}</option>)}
        </select></label>
        <label className="field"><span>Allocation</span><input type="number" min="1" max="300" value={assignment.allocation_percent} onChange={(event) => setAssignment({ ...assignment, allocation_percent: event.target.value })} /></label>
      </div>
      <CommandButton icon={Save} disabled={!selectedTask} loading={busy === "resource"} onClick={() => selectedTask && onAssignResource({ task_id: selectedTask.id, resource_id: assignment.resource_id, allocation_percent: Number(assignment.allocation_percent) })}>
        Assign selected
      </CommandButton>
      <h4>Capacity calendar</h4>
      {selectedResource?.calendar ? <p className="planning-muted">Current: {selectedResource.calendar.default_capacity_percent}% on weekdays {selectedResource.calendar.working_days.join(", ")} · {selectedResource.calendar.holidays.length} holidays</p> : null}
      <div className="planning-form-grid">
        <label className="field"><span>Working weekdays</span><input value={capacityCalendar.working_days} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, working_days: event.target.value })} /></label>
        <label className="field"><span>Holidays</span><input placeholder="2026-08-04, 2026-08-15" value={capacityCalendar.holidays} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, holidays: event.target.value })} /></label>
        <label className="field"><span>Default capacity %</span><input type="number" min="0" max="300" value={capacityCalendar.default_capacity_percent} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, default_capacity_percent: event.target.value })} /></label>
        <label className="field"><span>Exception start</span><input type="date" value={capacityCalendar.exception_start} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, exception_start: event.target.value })} /></label>
        <label className="field"><span>Exception end</span><input type="date" value={capacityCalendar.exception_end} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, exception_end: event.target.value })} /></label>
        <label className="field"><span>Exception capacity %</span><input type="number" min="0" max="300" value={capacityCalendar.exception_capacity} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, exception_capacity: event.target.value })} /></label>
        <label className="field"><span>Exception reason</span><input value={capacityCalendar.exception_reason} onChange={(event) => setCapacityCalendar({ ...capacityCalendar, exception_reason: event.target.value })} /></label>
      </div>
      <CommandButton icon={CalendarDays} disabled={!assignment.resource_id || Boolean(capacityCalendar.exception_start) !== Boolean(capacityCalendar.exception_end)} loading={busy === "resource-calendar"} onClick={() => onSetResourceCalendar(assignment.resource_id, {
        name: `${selectedResource?.name || "Resource"} capacity`,
        working_days: capacityCalendar.working_days.split(",").map((item) => Number(item.trim())).filter((item) => item >= 1 && item <= 7),
        holidays: capacityCalendar.holidays.split(",").map((item) => item.trim()).filter(Boolean),
        default_capacity_percent: Number(capacityCalendar.default_capacity_percent),
        capacity_exceptions: capacityCalendar.exception_start && capacityCalendar.exception_end ? [{
          start: capacityCalendar.exception_start, end: capacityCalendar.exception_end,
          capacity_percent: Number(capacityCalendar.exception_capacity), reason: capacityCalendar.exception_reason,
        }] : [],
      })}>Save capacity calendar</CommandButton>
    </section>
  );
}
