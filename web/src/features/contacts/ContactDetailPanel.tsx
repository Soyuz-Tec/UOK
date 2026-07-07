import { Archive, FileCheck2, Link2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { contactDetailPaneOptions } from "../../shared/options";
import { formatLabel } from "../../shared/format";
import { CommandButton, DetailItem, EmptyState, SegmentedControl, StatusPill } from "../../shared/ui";
import { ContactForm } from "./ContactForm";
import type { ContactsWorkspaceProps } from "./types";

export function ContactDetailPanel(props: ContactsWorkspaceProps) {
  const contact = props.selectedContact;
  const profile = contact?.business_profile;
  return (
    <div className="contact-detail" aria-label="Contact detail">
      <div className="contact-detail-header">
        <div>
          <h3>{contact?.display_name || "New contact"}</h3>
        </div>
        <div className="contacts-actions">
          {contact && <CommandButton icon={Pencil} onClick={props.onEdit}>Edit</CommandButton>}
          {contact?.status === "archived" ? (
            <CommandButton icon={RotateCcw} onClick={props.onRestore}>Restore</CommandButton>
          ) : (
            <CommandButton icon={Archive} onClick={props.onArchive} disabled={!contact} destructive>Delete</CommandButton>
          )}
          <CommandButton icon={Trash2} onClick={props.onPurge} disabled={!contact} destructive>Purge</CommandButton>
        </div>
      </div>

      {props.editing ? (
        <ContactForm draft={props.draft} onChange={props.onDraftChange} onSave={props.onSave} onCancel={props.onCancelEdit} busy={props.busyAction === "CreateContact" || props.busyAction === "UpdateContact"} />
      ) : contact ? (
        <>
          <SegmentedControl value={props.detailPane} onChange={props.onDetailPaneChange} options={contactDetailPaneOptions} label="Contact detail pane" />
          {props.detailPane === "overview" && (
            <div className="detail-grid">
              <DetailItem label="Type" value={formatLabel(contact.party_type)} />
              <DetailItem label="Email" value={contact.email || "-"} />
              <DetailItem label="Phone" value={contact.phone || "-"} />
              <DetailItem label="Website" value={contact.website || "-"} />
              <DetailItem label="Address" value={contact.address || "-"} />
              <DetailItem label="Status" value={formatLabel(contact.status)} />
              <DetailItem label="Review" value={formatLabel(contact.review_state)} />
              <DetailItem label="Source" value={formatLabel(contact.source)} />
              {contact.duplicate_candidates?.length ? <DetailItem label="Duplicates" value={contact.duplicate_candidates.map((item) => item.display_name).join(", ")} /> : null}
            </div>
          )}
          {props.detailPane === "intelligence" && (
            <div className="detail-section pane-section">
              <p className="eyebrow">Business Intelligence Profile</p>
              {profile ? (
                <>
                  <div className="detail-grid">
                    <DetailItem label="Summary" value={profile.summary || "No profile summary yet."} />
                    <DetailItem label="Confidence" value={formatLabel(profile.confidence || "unknown")} />
                    <DetailItem label="Sources" value={String(profile.source_count ?? 0)} />
                    <DetailItem label="Profile health" value={profile.scores?.profile_health !== undefined ? `${profile.scores.profile_health}%` : "-"} />
                    <DetailItem label="Completeness" value={profile.scores?.completeness !== undefined ? `${profile.scores.completeness}%` : "-"} />
                    <DetailItem label="Updated" value={profile.updated_at || "-"} />
                  </div>
                  <div className="record-list">
                    {profile.tags?.length ? (
                      <div className="record-row">Tags: {profile.tags.map((tag) => formatLabel(tag)).join(", ")}</div>
                    ) : null}
                    {profile.risk_flags?.length ? (
                      <div className="record-row">Risk flags: {profile.risk_flags.map((flag) => formatLabel(flag)).join(", ")}</div>
                    ) : null}
                    <div className="record-row"><StatusPill label="Normalized facts only" tone="info" /> Source evidence is stored with confidence and allowed-use metadata.</div>
                  </div>
                </>
              ) : (
                <EmptyState text="No business intelligence profile yet." />
              )}
            </div>
          )}
          {props.detailPane === "activity" && (
            <div className="detail-section pane-section">
              <p className="eyebrow">Notes</p>
              <div className="note-composer">
                <input value={props.noteText} onChange={(event) => props.onNoteTextChange(event.target.value)} placeholder="Internal note" disabled={!contact} />
                <CommandButton icon={FileCheck2} onClick={props.onAddNote} disabled={!contact || !props.noteText.trim()}>Add</CommandButton>
              </div>
              <div className="record-list">
                {contact.notes?.length ? contact.notes.map((note) => <div className="record-row" key={note.id}>{note.body}</div>) : <EmptyState text="No notes." />}
              </div>
            </div>
          )}
          {props.detailPane === "relationships" && (
            <div className="detail-section pane-section">
              <p className="eyebrow">Relationships</p>
              <div className="relationship-composer">
                <select value={props.relationshipTarget} onChange={(event) => props.onRelationshipTargetChange(event.target.value)} disabled={!contact}>
                  <option value="">Select contact</option>
                  {props.contacts.filter((row) => row.id !== contact.id).map((row) => <option key={row.id} value={row.id}>{row.display_name}</option>)}
                </select>
                <select value={props.relationshipType} onChange={(event) => props.onRelationshipTypeChange(event.target.value)} disabled={!contact}>
                  <option value="primary_contact">Primary contact</option>
                  <option value="works_for">Works for</option>
                  <option value="billing_contact">Billing contact</option>
                  <option value="decision_maker">Decision maker</option>
                  <option value="advisor">Advisor</option>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
                <CommandButton icon={Link2} onClick={props.onLinkRelationship} disabled={!contact || !props.relationshipTarget}>Link</CommandButton>
              </div>
              <div className="record-list">
                {contact.relationships?.length ? contact.relationships.map((rel) => <div className="record-row" key={rel.id}>{formatLabel(rel.relationship_type)}</div>) : <EmptyState text="No relationships." />}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState text="Select or create a contact." />
      )}
    </div>
  );
}
