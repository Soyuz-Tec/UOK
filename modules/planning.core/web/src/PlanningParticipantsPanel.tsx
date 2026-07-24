import { UserPlus, UserRoundX } from "lucide-react";
import { useEffect, useState } from "react";

import { CommandButton } from "@uok/shared/primitives";
import { loadPlanningPartyOptions } from "./planningApi";
import type { PlanningTaskParticipantCreateRequest } from "./planningContracts";
import type { PlanningParticipantRole, PlanningPartyOption, PlanningSchedule, PlanningTask } from "./types";

const roles: Array<[PlanningParticipantRole, string]> = [
  ["owner", "Owner"], ["assignee", "Assignee"], ["approver", "Approver"],
  ["consulted", "Consulted"], ["informed", "Informed"], ["external_contact", "External contact"],
];

export function PlanningParticipantsPanel({ token, schedule, selectedTask, busy, readOnly, onAdd, onRemove }: {
  token: string;
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  readOnly: boolean;
  onAdd: (taskId: string, payload: PlanningTaskParticipantCreateRequest) => Promise<void>;
  onRemove: (taskId: string, participantId: string) => Promise<void>;
}) {
  const [parties, setParties] = useState<PlanningPartyOption[]>([]);
  const [partyId, setPartyId] = useState("");
  const [role, setRole] = useState<PlanningParticipantRole>("assignee");
  const [providerStatus, setProviderStatus] = useState("Loading canonical parties.");
  useEffect(() => {
    let active = true;
    loadPlanningPartyOptions(token).then((rows) => {
      if (!active) return;
      setParties(rows);
      setProviderStatus(rows.length ? `${rows.length} active canonical parties available.` : "No active canonical parties are available.");
    }).catch(() => active && setProviderStatus("Contacts is unavailable or not authorized."));
    return () => { active = false; };
  }, [token]);
  const participants = (schedule.participants || []).filter((row) => row.task_id === selectedTask?.id);

  return (
    <section className="planning-editor" aria-label="Task participants">
      <h3>People</h3>
      <span className="planning-muted" role="status">{providerStatus}</span>
      {!selectedTask ? <span className="planning-muted">Select a task before assigning people.</span> : (
        <>
          <div className="planning-form-grid">
            <label className="field"><span>Party</span><select value={partyId} onChange={(event) => setPartyId(event.target.value)}>
              <option value="">Select canonical Party</option>
              {parties.map((party) => <option key={party.id} value={party.id}>{party.display_name}</option>)}
            </select></label>
            <label className="field"><span>Participant role</span><select value={role} onChange={(event) => setRole(event.target.value as PlanningParticipantRole)}>
              {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </div>
          <CommandButton icon={UserPlus} loading={busy === "participant"} disabled={readOnly || !partyId} onClick={() => onAdd(selectedTask.id, { party_id: partyId, role })}>Add participant</CommandButton>
        </>
      )}
      <div className="planning-list">
        {participants.map((participant) => (
          <div className="planning-dependency-row" key={participant.id}>
            <span><strong>{participant.resolution.display_label || "Protected or unavailable Party"}</strong> · {participant.role.replace("_", " ")} · {participant.resolution.status}</span>
            {participant.resolution.status === "ready" && participant.resolution.open_path ? <a href={participant.resolution.open_path}>Open</a> : null}
            <CommandButton icon={UserRoundX} loading={busy === "participant"} disabled={readOnly || !selectedTask} onClick={() => selectedTask && onRemove(selectedTask.id, participant.id)}>Remove</CommandButton>
          </div>
        ))}
        {!participants.length ? <span className="planning-muted">No participants assigned to this task.</span> : null}
      </div>
    </section>
  );
}
