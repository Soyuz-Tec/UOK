import { useEffect, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import type { ContactDraft } from "./contracts";
import { validEmail } from "@uok/shared/format";
import { FieldMessage } from "@uok/shared/forms";
import { ContactFormDisclosure } from "./ContactFormDisclosure";
import { contactDraftHasMeaningfulValue, contactDraftSectionState, isValidWebsite } from "./contactFormModel";
import type { AddableSection } from "./contactFormModel";

export function ContactForm({ draft, formKey, onChange, onSave, onCancel, busy }: {
  draft: ContactDraft;
  formKey: string;
  onChange: (draft: ContactDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const setField = (field: keyof ContactDraft, value: string) => onChange({ ...draft, [field]: value });
  const emailError = draft.email.trim() && !validEmail(draft.email) ? "Enter a valid email address." : "";
  const websiteError = draft.website.trim() && !isValidWebsite(draft.website) ? "Enter a valid website address." : "";
  const hasMeaningfulValue = contactDraftHasMeaningfulValue(draft);
  const canSave = hasMeaningfulValue && !emailError && !websiteError;
  const [addedSections, setAddedSections] = useState<Record<AddableSection, boolean>>({
    person: false,
    organization: false,
    dates: false,
    messaging: false,
    source: false,
    more: false
  });
  const { availableSections, visibleSections } = contactDraftSectionState(draft, addedSections);

  useEffect(() => {
    setAddedSections({ person: false, organization: false, dates: false, messaging: false, source: false, more: false });
  }, [formKey]);

  const addSection = (section: AddableSection) => {
    setAddedSections((current) => ({ ...current, [section]: true }));
  };

  return (
    <form className="contact-form" aria-label="Contact form" aria-describedby="contact-form-minimum" onSubmit={(event) => event.preventDefault()}>
      <p id="contact-form-minimum" className="form-hint">
        {hasMeaningfulValue ? "Ready for contact review after save." : "Add at least one name, organization, contact method, or note."}
      </p>
      <fieldset className="form-section">
        <legend>Essentials</legend>
        <div className="form-field-grid">
          <label className="field">
            <span>Type</span>
            <select value={draft.party_type} onChange={(event) => setField("party_type", event.target.value as ContactDraft["party_type"])}>
              <option value="person">Person</option>
              <option value="organization">Organization</option>
            </select>
          </label>
          <label className="field field-prominent"><span>Display name</span><input autoComplete="name" value={draft.display_name} onChange={(event) => setField("display_name", event.target.value)} /></label>
          <label className={emailError ? "field invalid" : "field"}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={draft.email}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "contact-email-error" : undefined}
              onChange={(event) => setField("email", event.target.value)}
            />
            {emailError && <FieldMessage id="contact-email-error">{emailError}</FieldMessage>}
          </label>
          <label className="field"><span>Phone</span><input type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
        </div>
      </fieldset>
      {availableSections.length ? (
        <div className="contact-form-addable-sections" aria-label="Add contact sections">
          {availableSections.map((section) => {
            const Icon = section.icon;
            return (
              <button key={section.id} type="button" className="contact-form-add-section" onClick={() => addSection(section.id)}>
                <Icon size={17} aria-hidden="true" />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {visibleSections.person && (
        <ContactFormDisclosure title="Person details" summary="Given and family name" defaultOpen>
          <label className="field"><span>Given name</span><input autoComplete="given-name" value={draft.given_name} onChange={(event) => setField("given_name", event.target.value)} /></label>
          <label className="field"><span>Family name</span><input autoComplete="family-name" value={draft.family_name} onChange={(event) => setField("family_name", event.target.value)} /></label>
        </ContactFormDisclosure>
      )}
      {visibleSections.organization && (
        <ContactFormDisclosure title="Organization details" summary="Organization, company link, title, and team" defaultOpen>
          <label className="field"><span>Organization</span><input autoComplete="organization" value={draft.organization_name} onChange={(event) => setField("organization_name", event.target.value)} /></label>
          <label className="field"><span>Company link</span><input value={draft.company_name} onChange={(event) => setField("company_name", event.target.value)} /></label>
          <label className="field"><span>Title</span><input autoComplete="organization-title" value={draft.title} onChange={(event) => setField("title", event.target.value)} /></label>
          <label className="field"><span>Team</span><input value={draft.team_id} onChange={(event) => setField("team_id", event.target.value)} /></label>
        </ContactFormDisclosure>
      )}
      {visibleSections.dates && (
        <ContactFormDisclosure title="Dates" summary="Birthday and important date" defaultOpen>
          <label className="field"><span>Birthday</span><input type="date" value={draft.birthday} onChange={(event) => setField("birthday", event.target.value)} /></label>
          <label className="field"><span>Important date</span><input type="date" value={draft.important_date} onChange={(event) => setField("important_date", event.target.value)} /></label>
        </ContactFormDisclosure>
      )}
      {visibleSections.messaging && (
        <ContactFormDisclosure title="Messaging and tags" summary="Instant message and searchable tags" defaultOpen>
          <label className="field"><span>Instant message</span><input value={draft.instant_message} onChange={(event) => setField("instant_message", event.target.value)} /></label>
          <label className="field field-wide"><span>Tags</span><input value={draft.tags} placeholder="supplier, finance, priority" onChange={(event) => setField("tags", event.target.value)} /></label>
        </ContactFormDisclosure>
      )}
      {visibleSections.source && (
        <ContactFormDisclosure title="Governance details" summary="Origin, consent, allowed use, and confidence" defaultOpen>
          <label className="field">
            <span>Source</span>
            <select value={draft.source} onChange={(event) => setField("source", event.target.value)}>
              <option value="">Keep default</option>
              <option value="contacts">Contacts</option>
              <option value="gmail">Gmail</option>
              <option value="csv_import">CSV import</option>
              <option value="vcard">vCard</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="field"><span>Reference</span><input value={draft.client_reference} onChange={(event) => setField("client_reference", event.target.value)} /></label>
          <label className="field">
            <span>Consent</span>
            <select value={draft.consent_status} onChange={(event) => setField("consent_status", event.target.value)}>
              <option value="">Unknown</option>
              <option value="business_contact">Business contact</option>
              <option value="consented">Consented</option>
              <option value="restricted">Restricted</option>
            </select>
          </label>
          <label className="field">
            <span>Allowed use</span>
            <select value={draft.allowed_use} onChange={(event) => setField("allowed_use", event.target.value)}>
              <option value="">Not set</option>
              <option value="operations">Operations</option>
              <option value="crm">CRM</option>
              <option value="restricted">Restricted</option>
              <option value="do_not_contact">Do not contact</option>
            </select>
          </label>
          <label className="field">
            <span>Confidence</span>
            <select value={draft.confidence_level} onChange={(event) => setField("confidence_level", event.target.value)}>
              <option value="">Unknown</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="verified">Verified</option>
            </select>
          </label>
        </ContactFormDisclosure>
      )}
      {visibleSections.more && (
        <ContactFormDisclosure title="More contact details" summary="Website, address, and internal note" defaultOpen>
          <label className={websiteError ? "field invalid" : "field"}>
            <span>Website</span>
            <input
              type="url"
              autoComplete="url"
              value={draft.website}
              aria-invalid={websiteError ? true : undefined}
              aria-describedby={websiteError ? "contact-website-error" : undefined}
              onChange={(event) => setField("website", event.target.value)}
            />
            {websiteError && <FieldMessage id="contact-website-error">{websiteError}</FieldMessage>}
          </label>
          <label className="field field-wide"><span>Address</span><input autoComplete="street-address" value={draft.address} onChange={(event) => setField("address", event.target.value)} /></label>
          <label className="field"><span>Note</span><textarea value={draft.note} onChange={(event) => setField("note", event.target.value)} rows={3} /></label>
        </ContactFormDisclosure>
      )}
      <div className="form-actions">
        <WorkspaceActionButton action="save" onClick={onSave} loading={busy} disabled={!canSave} primary />
        <WorkspaceActionButton action="close" onClick={onCancel} />
      </div>
    </form>
  );
}
