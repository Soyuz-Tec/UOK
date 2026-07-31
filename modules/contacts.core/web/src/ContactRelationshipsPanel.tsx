import { useState } from "react";
import { Check, Link2, Pencil, Unlink2, X } from "lucide-react";

import { formatLabel } from "@uok/shared/format";
import { EmptyState } from "@uok/shared/data-display";
import { CommandButton, IconButton } from "@uok/shared/primitives";
import { ContactRelationshipLookup } from "./ContactRelationshipLookup";
import type { ContactsWorkspaceProps } from "./types";

export function ContactRelationshipsPanel(props: ContactsWorkspaceProps & { contact: NonNullable<ContactsWorkspaceProps["selectedContact"]> }) {
  const { contact } = props;
  const [editingRelationshipId, setEditingRelationshipId] = useState("");
  const [relationshipEditTarget, setRelationshipEditTarget] = useState("");
  const [relationshipEditType, setRelationshipEditType] = useState("primary_contact");

  function startRelationshipEdit(rel: ContactRelationship) {
    setEditingRelationshipId(rel.id);
    setRelationshipEditTarget(relatedPartyId(rel));
    setRelationshipEditType(rel.relationship_type);
  }

  async function saveRelationshipEdit(rel: ContactRelationship) {
    const nextTarget = relationshipEditTarget || relatedPartyId(rel);
    if (!nextTarget) return;
    const inbound = relationshipIsInbound(contact.id, rel);
    const completed = await props.onUpdateRelationship(
      rel.id,
      inbound ? nextTarget : contact.id,
      inbound ? contact.id : nextTarget,
      relationshipEditType || rel.relationship_type
    );
    if (completed) setEditingRelationshipId("");
  }

  async function removeRelationship(rel: ContactRelationship) {
    const completed = await props.onRemoveRelationship(rel.id);
    if (completed && editingRelationshipId === rel.id) setEditingRelationshipId("");
  }

  return (
    <div className="detail-section pane-section">
      <p className="eyebrow">Relationships</p>
      <div className="relationship-composer">
        <ContactRelationshipLookup
          token={props.token}
          contactId={contact.id}
          value={props.relationshipTarget}
          initialLabel={props.contacts.find((row) => row.id === props.relationshipTarget)?.display_name}
          onChange={props.onRelationshipTargetChange}
        />
        <label className="field">
          <span>Relationship</span>
          <select value={props.relationshipType} onChange={(event) => props.onRelationshipTypeChange(event.target.value)}>
            {relationshipTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <CommandButton icon={Link2} onClick={props.onLinkRelationship} disabled={!props.relationshipTarget || Boolean(props.busyAction)}>Link</CommandButton>
      </div>
      <div className="record-list">
        {contact.relationships?.length ? contact.relationships.map((rel) => {
          const editingRelationship = editingRelationshipId === rel.id;
          return (
            <div className={editingRelationship ? "record-row relationship-row editing" : "record-row relationship-row"} key={rel.id}>
              {editingRelationship ? (
                <RelationshipEditor
                  token={props.token}
                  contactId={contact.id}
                  rel={rel}
                  target={relationshipEditTarget}
                  type={relationshipEditType}
                  busyAction={props.busyAction}
                  onTargetChange={setRelationshipEditTarget}
                  onTypeChange={setRelationshipEditType}
                  onCancel={() => setEditingRelationshipId("")}
                  onSave={() => void saveRelationshipEdit(rel)}
                />
              ) : (
                <>
                  <div className="relationship-row-main">
                    <strong>{rel.related_party_name || relatedPartyFallback(rel)}</strong>
                    <span>{formatLabel(rel.relationship_type)}{rel.related_party_type ? ` · ${formatLabel(rel.related_party_type)}` : ""}</span>
                    {rel.related_party_email ? <small>{rel.related_party_email}</small> : null}
                  </div>
                  <div className="relationship-row-actions">
                    <IconButton icon={Pencil} label={`Edit relationship with ${rel.related_party_name || relatedPartyFallback(rel)}`} onClick={() => startRelationshipEdit(rel)} disabled={Boolean(props.busyAction)} />
                    <IconButton icon={Unlink2} label={`Unlink ${rel.related_party_name || relatedPartyFallback(rel)}`} onClick={() => void removeRelationship(rel)} disabled={Boolean(props.busyAction)} />
                  </div>
                </>
              )}
            </div>
          );
        }) : <EmptyState text="No relationships." />}
      </div>
    </div>
  );
}

function RelationshipEditor({
  busyAction,
  contactId,
  token,
  rel,
  target,
  type,
  onCancel,
  onSave,
  onTargetChange,
  onTypeChange
}: {
  busyAction: string;
  contactId: string;
  token: string;
  rel: ContactRelationship;
  target: string;
  type: string;
  onCancel: () => void;
  onSave: () => void;
  onTargetChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}) {
  return (
    <>
      <div className="relationship-edit-fields">
        <ContactRelationshipLookup
          token={token}
          contactId={contactId}
          value={target}
          initialLabel={rel.related_party_name || relatedPartyFallback(rel)}
          onChange={onTargetChange}
        />
        <label className="field">
          <span>Relationship</span>
          <select value={type} onChange={(event) => onTypeChange(event.target.value)}>
            {relationshipTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="relationship-row-actions">
        <IconButton icon={Check} label="Save relationship" primary onClick={onSave} disabled={!target || Boolean(busyAction)} />
        <IconButton icon={X} label="Cancel relationship edit" onClick={onCancel} disabled={Boolean(busyAction)} />
      </div>
    </>
  );
}

type ContactRelationship = NonNullable<NonNullable<ContactsWorkspaceProps["selectedContact"]>["relationships"]>[number];

const relationshipTypeOptions = [
  { id: "primary_contact", label: "Primary contact" },
  { id: "works_for", label: "Works for" },
  { id: "billing_contact", label: "Billing contact" },
  { id: "decision_maker", label: "Decision maker" },
  { id: "finance_contact", label: "Finance contact" },
  { id: "operations_contact", label: "Operations contact" },
  { id: "advisor", label: "Advisor" },
  { id: "customer", label: "Customer" },
  { id: "supplier", label: "Supplier" },
  { id: "supplier_contact", label: "Supplier contact" }
];

function relatedPartyFallback(rel: ContactRelationship) {
  return rel.related_party_id || rel.to_party_id || rel.from_party_id || "Related contact";
}

function relatedPartyId(rel: ContactRelationship) {
  return rel.related_party_id || rel.to_party_id || rel.from_party_id || "";
}

function relationshipIsInbound(contactId: string, rel: ContactRelationship) {
  if (rel.direction === "inbound") return true;
  if (rel.direction === "outbound") return false;
  return rel.to_party_id === contactId;
}
