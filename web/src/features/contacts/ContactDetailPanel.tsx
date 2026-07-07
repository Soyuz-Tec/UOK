import { FileCheck2 } from "lucide-react";

import { contactDetailPaneOptions } from "../../shared/options";
import { formatLabel } from "../../shared/format";
import { DetailItem, EmptyState } from "../../shared/data-display";
import { CommandButton, IconButton, SegmentedControl } from "../../shared/primitives";
import { ContactBusinessIntelligenceProfilePanel } from "./ContactBusinessIntelligenceProfile";
import { ContactFactRows } from "./ContactFactRows";
import { ContactForm } from "./ContactForm";
import { ContactGroupMembership } from "./ContactGroupMembership";
import { ContactInspectorHeader } from "./ContactInspectorHeader";
import { ContactRelationshipsPanel } from "./ContactRelationshipsPanel";
import { ContactReviewGuidance } from "./ContactReviewGuidance";
import { contactFacts } from "./contactPresentation";
import type { ContactsWorkspaceProps } from "./types";

export function ContactDetailPanel(props: ContactsWorkspaceProps) {
  const contact = props.selectedContact;

  return (
    <div className="contact-detail" aria-label="Contact detail">
      <ContactInspectorHeader
        contact={contact}
        editing={props.editing}
        onEdit={props.onEdit}
        onArchive={props.onArchive}
        onRestore={props.onRestore}
        onPurge={props.onPurge}
        onInlineUpdate={props.onInlineUpdate}
      />

      {props.editing ? (
        <ContactForm
          draft={props.draft}
          formKey={contact?.id || "new-contact"}
          onChange={props.onDraftChange}
          onSave={props.onSave}
          onCancel={props.onCancelEdit}
          busy={props.busyAction === "CreateContact" || props.busyAction === "UpdateContact"}
        />
      ) : contact ? (
        <>
          <SegmentedControl value={props.detailPane} onChange={props.onDetailPaneChange} options={contactDetailPaneOptions} label="Contact detail pane" />
          {props.detailPane === "overview" && (
            <>
              <ContactReviewGuidance contact={contact} />
              <ContactFactRows facts={contactFacts(contact)} />
              <ContactGroupMembership
                contact={contact}
                groups={props.contactGroups}
                onAddToGroup={props.onAddSelectedContactToGroup}
                onRemoveFromGroup={props.onRemoveSelectedContactFromGroup}
              />
              <details className="contact-technical-details">
                <summary>Technical details</summary>
                <div className="detail-grid contact-operational-grid">
                  <DetailItem label="Type" value={formatLabel(contact.party_type)} />
                  <DetailItem label="Status" value={formatLabel(contact.status)} />
                  <DetailItem label="Review" value={formatLabel(contact.review_state)} />
                  <DetailItem label="Source" value={formatLabel(contact.source)} />
                  {contact.duplicate_candidates?.length ? <DetailItem label="Duplicates" value={contact.duplicate_candidates.map((item) => item.display_name).join(", ")} /> : null}
                </div>
              </details>
            </>
          )}
          {props.detailPane === "intelligence" && contact && (
            <ContactBusinessIntelligenceProfilePanel contact={contact} />
          )}
          {props.detailPane === "activity" && (
            <div className="detail-section pane-section">
              <p className="eyebrow">Notes</p>
              <div className="note-composer">
                <label className="field note-field">
                  <span>Internal note</span>
                  <input value={props.noteText} onChange={(event) => props.onNoteTextChange(event.target.value)} disabled={!contact} />
                </label>
                <CommandButton icon={FileCheck2} onClick={props.onAddNote} disabled={!contact || !props.noteText.trim()}>Add</CommandButton>
              </div>
              <div className="record-list">
                {contact.notes?.length ? contact.notes.map((note) => <div className="record-row" key={note.id}>{note.body}</div>) : <EmptyState text="No notes." />}
              </div>
            </div>
          )}
          {props.detailPane === "relationships" && (
            <ContactRelationshipsPanel {...props} contact={contact} />
          )}
        </>
      ) : (
        <div className="contact-detail-empty">
          <EmptyState text="Select a contact or create a new one." />
        </div>
      )}
    </div>
  );
}
