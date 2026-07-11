import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "@uok/shared/primitives";
import type { PlanningLinkCreateRequest } from "./planningContracts";
import type { PlanningLinkRelationship, PlanningLinkTargetKind, PlanningSchedule, PlanningTask } from "./types";

const targetKinds: Array<[PlanningLinkTargetKind, string]> = [
  ["operation", "Operation"], ["gate", "Gate"], ["evidence", "Evidence"], ["party", "Party"],
  ["shipment", "Shipment"], ["document", "Document"], ["location", "Location"], ["asset", "Asset"],
  ["agreement", "Agreement"], ["communication_thread", "Communication thread"], ["calendar_event", "Calendar event"],
];
const relationships: Array<[PlanningLinkRelationship, string]> = [
  ["implements", "Implements"], ["blocks_on", "Blocks on"], ["requires", "Requires"], ["proves", "Proves"],
  ["owned_by", "Owned by"], ["moves", "Moves"], ["occurs_at", "Occurs at"], ["discussed_in", "Discussed in"], ["publishes_to", "Publishes to"],
];

export function PlanningOperationLinksPanel({ schedule, selectedTask, busy, readOnly, onCreate, onRemove }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  readOnly: boolean;
  onCreate: (payload: PlanningLinkCreateRequest) => Promise<void>;
  onRemove: (linkId: string) => Promise<void>;
}) {
  const [targetKind, setTargetKind] = useState<PlanningLinkTargetKind>("party");
  const [relationship, setRelationship] = useState<PlanningLinkRelationship>("owned_by");
  const [targetId, setTargetId] = useState("");
  const [blocking, setBlocking] = useState(false);
  const visibleLinks = useMemo(
    () => schedule.links.filter((link) => !link.task_id || link.task_id === selectedTask?.id),
    [schedule.links, selectedTask?.id],
  );

  async function createLink() {
    const id = targetId.trim();
    if (!id) return;
    await onCreate({
      scope_type: selectedTask ? "task" : "project",
      ...(selectedTask ? { task_id: selectedTask.id } : {}),
      relationship,
      blocking,
      target: { kind: targetKind, id },
    });
    setTargetId("");
  }

  return (
    <section className="planning-editor" aria-label="Operation links">
      <div>
        <strong>Operation links</strong>
        <p className="planning-muted">References resolve through the target module without copying its private payload.</p>
      </div>
      <fieldset disabled={readOnly} aria-disabled={readOnly}>
        <label className="field"><span>Target type</span><select value={targetKind} onChange={(event) => setTargetKind(event.target.value as PlanningLinkTargetKind)}>
          {targetKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="field"><span>Relationship</span><select value={relationship} onChange={(event) => setRelationship(event.target.value as PlanningLinkRelationship)}>
          {relationships.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="field"><span>Target ID</span><input value={targetId} maxLength={180} onChange={(event) => setTargetId(event.target.value)} placeholder="Stable source-object ID" /></label>
        <label className="planning-check"><input type="checkbox" checked={blocking} onChange={(event) => setBlocking(event.target.checked)} />Blocks readiness</label>
        <CommandButton icon={Link2} loading={busy === "planning-link"} disabled={!targetId.trim()} onClick={() => void createLink()}>Add link</CommandButton>
      </fieldset>
      {readOnly ? <span className="planning-muted">The server has not granted Planning link authority.</span> : null}
      <div className="planning-list">
        {visibleLinks.length ? visibleLinks.map((link) => (
          <div className="planning-list-row" key={link.id}>
            <span><strong>{link.resolution.display_label || link.target.kind}</strong><small>{link.relationship} · {link.resolution.status} · {link.resolution.status_summary}</small></span>
            {link.resolution.status === "ready" && link.resolution.open_path ? <a className="command-button" href={link.resolution.open_path}><ExternalLink size={15} aria-hidden="true" />Open</a> : null}
            <CommandButton icon={Trash2} loading={busy === "planning-link"} disabled={readOnly} onClick={() => void onRemove(link.id)}>Remove</CommandButton>
          </div>
        )) : <span className="planning-muted">No project or selected-task links.</span>}
      </div>
    </section>
  );
}
