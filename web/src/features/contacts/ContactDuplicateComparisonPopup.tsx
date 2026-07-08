import { ArrowRight, GitMerge } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { ContactMergeField, ContactMergeFieldChoices, ContactRecord } from "../../shared/types";
import { WorkspaceEditorPopup } from "../../shared/overlays";
import { CommandButton } from "../../shared/primitives";
import { ContactFactRows } from "./ContactFactRows";
import { contactFacts, contactInitial } from "./contactPresentation";

const COMPARABLE_FIELDS: Array<{ key: ContactMergeField; label: string }> = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "organization_name", label: "Organization" },
  { key: "title", label: "Role" },
  { key: "given_name", label: "First name" },
  { key: "family_name", label: "Last name" }
];

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
  onMerge: (primaryContactId: string, duplicateContactId: string, fieldChoices?: ContactMergeFieldChoices) => void;
  onOpenMatch: (id: string) => void;
}) {
  const [fieldChoicesByMatch, setFieldChoicesByMatch] = useState<Record<string, ContactMergeFieldChoices>>({});
  const setFieldChoice = (matchId: string, field: ContactMergeField, value: "primary" | "duplicate") => {
    setFieldChoicesByMatch((current) => ({
      ...current,
      [matchId]: { ...(current[matchId] || {}), [field]: value }
    }));
  };

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
                <DuplicateFieldChoices
                  primary={contact}
                  duplicate={match}
                  choices={fieldChoicesByMatch[match.id] || {}}
                  onChoice={(field, value) => setFieldChoice(match.id, field, value)}
                />
                <CommandButton icon={ArrowRight} onClick={() => onOpenMatch(match.id)}>Open this contact</CommandButton>
                {contact ? (
                  <>
                    <CommandButton icon={GitMerge} onClick={() => onMerge(contact.id, match.id, fieldChoicesByMatch[match.id] || {})} disabled={mergeBusy}>Merge into selected</CommandButton>
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

function DuplicateFieldChoices({
  primary,
  duplicate,
  choices,
  onChoice
}: {
  primary: ContactRecord;
  duplicate: ContactRecord;
  choices: ContactMergeFieldChoices;
  onChoice: (field: ContactMergeField, value: "primary" | "duplicate") => void;
}) {
  const rows = COMPARABLE_FIELDS
    .map(({ key, label }) => ({
      key,
      label,
      primaryValue: contactFieldValue(primary, key),
      duplicateValue: contactFieldValue(duplicate, key)
    }))
    .filter((row) => row.duplicateValue && row.primaryValue !== row.duplicateValue);

  if (!rows.length) return null;
  return (
    <div className="duplicate-field-choice-list" aria-label={`Field choices for ${duplicate.display_name}`}>
      <strong>Choose facts to keep</strong>
      {rows.map((row) => {
        const selected = choices[row.key] || "primary";
        return (
          <div className="duplicate-field-choice" key={row.key}>
            <span>{row.label}</span>
            <div className="duplicate-field-choice-options">
              <button
                type="button"
                aria-label={`Use selected ${row.label}`}
                aria-pressed={selected === "primary"}
                onClick={() => onChoice(row.key, "primary")}
              >
                Selected
              </button>
              <button
                type="button"
                aria-label={`Use match ${row.label}`}
                aria-pressed={selected === "duplicate"}
                onClick={() => onChoice(row.key, "duplicate")}
              >
                Match
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function contactFieldValue(contact: ContactRecord, field: ContactMergeField) {
  return String(contact[field] || contact.attrs?.[field] || "").trim();
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
