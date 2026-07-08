import { ArrowRight, GitMerge } from "lucide-react";
import type { ReactNode } from "react";

import type { ContactRecord } from "../../shared/types";
import { WorkspaceEditorPopup } from "../../shared/overlays";
import { CommandButton } from "../../shared/primitives";
import { ContactFactRows } from "./ContactFactRows";
import { contactFacts, contactInitial } from "./contactPresentation";

export function ContactDuplicateComparisonPopup({
  open,
  contact,
  matches,
  mergeBusy,
  onClose,
  onMerge,
  onOpenMatch
}: {
  open: boolean;
  contact: ContactRecord | null;
  matches: ContactRecord[];
  mergeBusy: boolean;
  onClose: () => void;
  onMerge: (primaryContactId: string, duplicateContactId: string) => void;
  onOpenMatch: (id: string) => void;
}) {
  return (
    <WorkspaceEditorPopup
      open={open && Boolean(contact)}
      label="Compare duplicate contacts"
      title="Compare duplicate contacts"
      description="Review suspected duplicate records before deciding which contact should remain authoritative."
      onClose={onClose}
      size="wide"
      className="contact-duplicate-popup"
    >
      {contact ? (
        <div className="duplicate-comparison-grid">
          <DuplicateCard contact={contact} heading="Selected contact" />
          <div className="duplicate-match-list">
            {matches.length ? matches.map((match) => (
              <DuplicateCard contact={match} heading="Possible match" key={match.id}>
                <CommandButton icon={ArrowRight} onClick={() => onOpenMatch(match.id)}>Open this contact</CommandButton>
                {contact ? (
                  <>
                    <CommandButton icon={GitMerge} onClick={() => onMerge(contact.id, match.id)} disabled={mergeBusy}>Keep selected</CommandButton>
                    <CommandButton icon={GitMerge} onClick={() => onMerge(match.id, contact.id)} disabled={mergeBusy} primary>Keep this match</CommandButton>
                  </>
                ) : null}
              </DuplicateCard>
            )) : (
              <div className="duplicate-card empty">
                <GitMerge size={24} aria-hidden="true" />
                <strong>No matching record found in the current result set.</strong>
                <p>Try searching by name, email, or phone to bring possible duplicates into view.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </WorkspaceEditorPopup>
  );
}

function DuplicateCard({
  contact,
  heading,
  children
}: {
  contact: ContactRecord;
  heading: string;
  children?: ReactNode;
}) {
  return (
    <section className="duplicate-card" aria-label={`${heading}: ${contact.display_name}`}>
      <div className="duplicate-card-header">
        <span className="contact-card-avatar compact">{contactInitial(contact.display_name)}</span>
        <div className="contact-name-stack">
          <span>{heading}</span>
          <strong>{contact.display_name}</strong>
          <small>{contact.email || contact.phone || contact.source}</small>
        </div>
      </div>
      <ContactFactRows facts={contactFacts(contact)} compact emptyText="No contact facts to compare." />
      {children ? <div className="duplicate-card-actions">{children}</div> : null}
    </section>
  );
}
