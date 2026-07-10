import { Flag, Users } from "lucide-react";
import { useMemo } from "react";

import { SearchField } from "../../shared/forms";
import type { PlanningFilterState } from "./planningTimelineModel";
import type { PlanningSchedule } from "./types";

export function PlanningFilters({
  filters,
  schedule,
  onChange,
}: {
  filters: PlanningFilterState;
  schedule: PlanningSchedule;
  onChange: (filters: PlanningFilterState) => void;
}) {
  const statuses = useMemo(() => Array.from(new Set(schedule.tasks.map((task) => task.status || "planned"))).sort(), [schedule.tasks]);
  const parties = useMemo(() => Array.from(new Map((schedule.participants || []).filter((row) => row.party.id && row.resolution.display_label).map((row) => [row.party.id as string, row])).values()), [schedule.participants]);

  return (
    <div className="planning-filters" aria-label="Planning search and filters">
      <SearchField
        label="Search planning tasks"
        placeholder="Search tasks"
        value={filters.query}
        onChange={(query) => onChange({ ...filters, query })}
      />
      <label className="planning-toolbar-select">
        <Flag size={16} aria-hidden="true" />
        <span>Filter</span>
        <select value={filters.mode} onChange={(event) => onChange({ ...filters, mode: event.target.value as PlanningFilterState["mode"] })}>
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="milestones">Milestones</option>
          <option value="not_ready">Not ready</option>
        </select>
      </label>
      <label className="planning-toolbar-select">
        <span>Status</span>
        <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
          <option value="">Any status</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label className="planning-toolbar-select">
        <Users size={16} aria-hidden="true" />
        <span>Participant</span>
        <select value={filters.partyId} onChange={(event) => onChange({ ...filters, partyId: event.target.value })}>
          <option value="">Any participant</option>
          {parties.map((participant) => <option key={participant.party.id as string} value={participant.party.id as string}>{participant.resolution.display_label}</option>)}
        </select>
      </label>
      <label className="planning-toolbar-select">
        <Users size={16} aria-hidden="true" />
        <span>Resource</span>
        <select value={filters.resourceId} onChange={(event) => onChange({ ...filters, resourceId: event.target.value })}>
          <option value="">Any resource</option>
          {schedule.resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
        </select>
      </label>
    </div>
  );
}
