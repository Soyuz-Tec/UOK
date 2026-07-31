import { CheckCircle2, FileCheck2, Link2, Send, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "@uok/shared/primitives";
import type {
  PlanningTaskRequirementAdvanceRequest,
  PlanningTaskRequirementCreateRequest,
  PlanningTaskRequirementDecisionRequest,
  PlanningTaskRequirementLinkRequest,
} from "./planningContracts";
import type { PlanningRequirementType, PlanningSchedule, PlanningTask, PlanningTaskRequirement } from "./types";

const requirementTypes: Array<[PlanningRequirementType, string]> = [
  ["approval", "Approval"], ["evidence", "Evidence"], ["document", "Document"],
  ["compliance", "Compliance"], ["finance", "Finance"], ["shipment", "Shipment"], ["custom", "Custom"],
];

const linkKinds: Partial<Record<PlanningRequirementType, string[]>> = {
  evidence: ["evidence"],
  document: ["document"],
  shipment: ["shipment"],
};

export function PlanningRequirementsPanel({ schedule, selectedTask, busy, readOnly, canApprove, onCreate, onAdvance, onSetLink, onDecide }: {
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  busy: string;
  readOnly: boolean;
  canApprove: boolean;
  onCreate: (taskId: string, payload: PlanningTaskRequirementCreateRequest) => Promise<void>;
  onAdvance: (taskId: string, requirementId: string, payload: PlanningTaskRequirementAdvanceRequest) => Promise<void>;
  onSetLink: (taskId: string, requirementId: string, payload: PlanningTaskRequirementLinkRequest) => Promise<void>;
  onDecide: (taskId: string, requirementId: string, payload: PlanningTaskRequirementDecisionRequest) => Promise<void>;
}) {
  const [type, setType] = useState<PlanningRequirementType>("approval");
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState(true);
  const [due, setDue] = useState("");
  const [targetLinkId, setTargetLinkId] = useState("");
  const requirements = (schedule.requirements || []).filter((row) => row.task_id === selectedTask?.id);
  const compatibleLinks = useMemo(() => {
    return compatibleRequirementLinks(schedule.links, selectedTask?.id, type);
  }, [schedule.links, selectedTask?.id, type]);
  const readiness = selectedTask?.readiness || { ready: true, required_count: 0, blocking_count: 0 };

  return (
    <section className="planning-editor" aria-label="Task gates and requirements">
      <h3>Gates</h3>
      <span className="planning-muted" role="status">
        {readiness.ready ? `Ready · ${readiness.required_count} required gate(s).` : `Not ready · ${readiness.blocking_count} required blocker(s).`}
      </span>
      {!selectedTask ? <span className="planning-muted">Select a task before defining gates.</span> : (
        <>
          <div className="planning-form-grid">
            <label className="field"><span>Requirement type</span><select value={type} onChange={(event) => { setType(event.target.value as PlanningRequirementType); setTargetLinkId(""); }}>
              {requirementTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="field"><span>Title</span><input value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="field"><span>Due date</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
            <label className="field"><span>Linked source</span><select value={targetLinkId} onChange={(event) => setTargetLinkId(event.target.value)}>
              <option value="">No linked source</option>
              {compatibleLinks.map((link) => <option key={link.id} value={link.id}>{link.target.kind} · {link.resolution.display_label || link.resolution.status}</option>)}
            </select></label>
            <label className="planning-check"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /><span>Required blocker</span></label>
          </div>
          <CommandButton icon={FileCheck2} loading={busy === "requirement"} disabled={readOnly || title.trim().length < 2} onClick={() => onCreate(selectedTask.id, {
            requirement_type: type,
            title: title.trim(),
            required,
            ...(targetLinkId ? { target_link_id: targetLinkId } : {}),
            ...(due ? { due } : {}),
          })}>Add gate</CommandButton>
        </>
      )}
      <div className="planning-list">
        {requirements.map((requirement) => (
          <RequirementRow
            key={`${requirement.id}:${requirement.target_link_id || "unlinked"}`}
            requirement={requirement}
            links={compatibleRequirementLinks(schedule.links, selectedTask?.id, requirement.requirement_type)}
            busy={busy}
            readOnly={readOnly}
            canApprove={canApprove}
            onAdvance={(payload) => onAdvance(requirement.task_id, requirement.id, payload)}
            onSetLink={(payload) => onSetLink(requirement.task_id, requirement.id, payload)}
            onDecide={(payload) => onDecide(requirement.task_id, requirement.id, payload)}
          />
        ))}
        {!requirements.length ? <span className="planning-muted">No gates defined for this task.</span> : null}
      </div>
    </section>
  );
}

function RequirementRow({ requirement, links, busy, readOnly, canApprove, onAdvance, onSetLink, onDecide }: {
  requirement: PlanningTaskRequirement;
  links: PlanningSchedule["links"];
  busy: string;
  readOnly: boolean;
  canApprove: boolean;
  onAdvance: (payload: PlanningTaskRequirementAdvanceRequest) => Promise<void>;
  onSetLink: (payload: PlanningTaskRequirementLinkRequest) => Promise<void>;
  onDecide: (payload: PlanningTaskRequirementDecisionRequest) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [sourceLinkId, setSourceLinkId] = useState(requirement.target_link_id || "");
  const loading = busy === "requirement" || busy === "requirement-decision";
  return (
    <article className="planning-dependency-row planning-requirement-row" data-blocking={requirement.blocking ? "true" : "false"}>
      <span>
        {requirement.blocking ? <ShieldAlert size={16} aria-label="Blocking" /> : <CheckCircle2 size={16} aria-label="Non-blocking" />}
        <strong>{requirement.title}</strong> · {requirement.requirement_type} · {requirement.state.replace("_", " ")}
        {requirement.due ? ` · due ${requirement.due}` : ""} · source {requirement.target_link_state}
      </span>
      {requirement.decision_reason ? <span className="planning-muted">Decision: {requirement.decision_reason}</span> : null}
      <div className="planning-action-row planning-requirement-source">
        <label className="field"><span>Requirement source</span><select aria-label={`Source for ${requirement.title}`} value={sourceLinkId} onChange={(event) => setSourceLinkId(event.target.value)}>
          <option value="">No linked source</option>
          {links.map((link) => <option key={link.id} value={link.id}>{link.target.kind} · {link.resolution.display_label || link.resolution.status}</option>)}
        </select></label>
        <CommandButton icon={Link2} loading={loading} disabled={readOnly || sourceLinkId === (requirement.target_link_id || "")} onClick={() => onSetLink({ target_link_id: sourceLinkId || null })}>Update source</CommandButton>
      </div>
      {(requirement.state === "missing" || requirement.state === "rejected") ? (
        <CommandButton icon={Send} loading={loading} disabled={readOnly} onClick={() => onAdvance({ action: "submit" })}>Submit</CommandButton>
      ) : null}
      {requirement.state === "submitted" ? (
        <CommandButton icon={FileCheck2} loading={loading} disabled={readOnly} onClick={() => onAdvance({ action: "start_review" })}>Start review</CommandButton>
      ) : null}
      {requirement.state === "under_review" ? (
        <div className="planning-action-row">
          <label className="field"><span>Decision reason</span><input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>
          <CommandButton icon={CheckCircle2} loading={loading} disabled={readOnly || !canApprove || !reason.trim()} onClick={() => onDecide({ decision: "satisfy", reason: reason.trim() })}>Satisfy</CommandButton>
          <CommandButton icon={ShieldAlert} loading={loading} disabled={readOnly || !canApprove || !reason.trim()} onClick={() => onDecide({ decision: "reject", reason: reason.trim() })}>Reject</CommandButton>
          <CommandButton icon={FileCheck2} loading={loading} disabled={readOnly || !canApprove || !reason.trim()} onClick={() => onDecide({ decision: "waive", reason: reason.trim() })}>Waive</CommandButton>
        </div>
      ) : null}
      {!canApprove && requirement.state === "under_review" ? <span className="planning-muted">Gate approval permission is required for a decision.</span> : null}
    </article>
  );
}

function compatibleRequirementLinks(links: PlanningSchedule["links"], taskId: string | undefined, type: PlanningRequirementType) {
  const accepted = linkKinds[type];
  return links.filter((link) => (
    (!link.task_id || link.task_id === taskId)
    && (!accepted || accepted.includes(link.target.kind))
  ));
}
