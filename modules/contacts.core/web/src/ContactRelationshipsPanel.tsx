import { Link2, Pencil, Unlink2 } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { formatLabel } from "@uok/shared/format";
import { CommandButton, IconButton } from "@uok/shared/primitives";
import {
  ContactRelationshipEditor,
  ContactRelationshipTypeSelect,
  useContactRelationshipEditor,
} from "./ContactRelationshipEditor";
import { ContactRelationshipLookup } from "./ContactRelationshipLookup";
import type { ContactRelationship, ContactsWorkspaceProps } from "./types";

export function ContactRelationshipsPanel(
  props: ContactsWorkspaceProps & {
    contact: NonNullable<ContactsWorkspaceProps["selectedContact"]>;
  },
) {
  const { contact } = props;
  const editor = useContactRelationshipEditor(JSON.stringify([
    contact.id,
    contact.updated_at || "",
    props.canManage,
  ]));

  async function saveRelationshipEdit(rel: ContactRelationship) {
    const intent = editor.intent(rel.id);
    if (!props.canManage || !intent) return;
    const nextTarget = editor.target || relatedPartyId(rel);
    if (!nextTarget) return;
    const inbound = relationshipIsInbound(contact.id, rel);
    const completed = await props.onUpdateRelationship(
      rel.id,
      inbound ? nextTarget : contact.id,
      inbound ? contact.id : nextTarget,
      editor.type || rel.relationship_type,
      intent,
    );
    if (completed && intent.isCurrent(intent.generation)) editor.cancel();
  }

  return (
    <div className="detail-section pane-section">
      <p className="eyebrow">Relationships</p>
      {props.canManage ? (
        <div className="relationship-composer">
          <ContactRelationshipLookup
            boundary={props.contactReadBoundary}
            onUnauthorized={props.onUnauthorized}
            canManage={props.canManage}
            contactId={contact.id}
            value={props.relationshipTarget}
            initialLabel={props.contacts.find((row) => row.id === props.relationshipTarget)?.display_name}
            onChange={props.onRelationshipTargetChange}
          />
          <ContactRelationshipTypeSelect
            value={props.relationshipType}
            onChange={props.onRelationshipTypeChange}
            disabled={Boolean(props.busyAction)}
          />
          <CommandButton icon={Link2} onClick={props.onLinkRelationship} disabled={!props.relationshipTarget || Boolean(props.busyAction)}>Link</CommandButton>
        </div>
      ) : null}
      <div className="record-list">
        {contact.relationships?.length ? contact.relationships.map((rel) => (
          <div className={editor.isEditing(rel.id) ? "record-row relationship-row editing" : "record-row relationship-row"} key={rel.id}>
            {editor.isEditing(rel.id) ? (
              <ContactRelationshipEditor
                boundary={props.contactReadBoundary}
                onUnauthorized={props.onUnauthorized}
                canManage={props.canManage}
                contactId={contact.id}
                rel={rel}
                target={editor.target}
                type={editor.type}
                busyAction={props.busyAction}
                onTargetChange={editor.changeTarget}
                onTypeChange={editor.changeType}
                onCancel={editor.cancel}
                onSave={() => void saveRelationshipEdit(rel)}
              />
            ) : (
              <RelationshipRow
                rel={rel}
                canManage={props.canManage}
                busyAction={props.busyAction}
                onEdit={() => editor.start(rel)}
                onRemove={() => void props.onRemoveRelationship(rel.id)}
              />
            )}
          </div>
        )) : <EmptyState text="No relationships." />}
      </div>
    </div>
  );
}

function RelationshipRow({
  rel,
  canManage,
  busyAction,
  onEdit,
  onRemove,
}: {
  rel: ContactRelationship;
  canManage: boolean;
  busyAction: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="relationship-row-main">
        <strong>{rel.related_party_name || relatedPartyFallback(rel)}</strong>
        <span>{formatLabel(rel.relationship_type)}{rel.related_party_type ? ` · ${formatLabel(rel.related_party_type)}` : ""}</span>
        {rel.related_party_email ? <small>{rel.related_party_email}</small> : null}
      </div>
      {canManage ? (
        <div className="relationship-row-actions">
          <IconButton icon={Pencil} label={`Edit relationship with ${rel.related_party_name || relatedPartyFallback(rel)}`} onClick={onEdit} disabled={Boolean(busyAction)} />
          <IconButton icon={Unlink2} label={`Unlink ${rel.related_party_name || relatedPartyFallback(rel)}`} onClick={onRemove} disabled={Boolean(busyAction)} />
        </div>
      ) : null}
    </>
  );
}

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
