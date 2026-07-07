import { useEffect, useState } from "react";
import { Building2, FileText, Save, UserRound, X } from "lucide-react";

import type { ContactDraft } from "../../shared/types";
import { FieldMessage } from "../../shared/forms";
import { CommandButton } from "../../shared/primitives";
import { ContactFormDisclosure } from "./ContactFormDisclosure";

type AddableSection = "person" | "organization" | "more";

const addableSections: Array<{ id: AddableSection; label: string; description: string; icon: typeof UserRound }> = [
  { id: "person", label: "Person details", description: "Given and family name", icon: UserRound },
  { id: "organization", label: "Organization details", description: "Company, title, and team", icon: Building2 },
  { id: "more", label: "More details", description: "Website, address, and note", icon: FileText }
];

export function ContactForm({ draft, formKey, onChange, onSave, onCancel, busy }: {
  draft: ContactDraft;
  formKey: string;
  onChange: (draft: ContactDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const setField = (field: keyof ContactDraft, value: string) => onChange({ ...draft, [field]: value });
  const emailError = draft.email.trim() && !isValidEmail(draft.email) ? "Enter a valid email address." : "";
  const websiteError = draft.website.trim() && !isValidWebsite(draft.website) ? "Enter a valid website address." : "";
  const hasMeaningfulValue = [
    draft.display_name,
    draft.given_name,
    draft.family_name,
    draft.organization_name,
    draft.company_name,
    draft.email,
    draft.phone,
    draft.website,
    draft.address,
    draft.title,
    draft.note
  ].some((value) => value.trim().length > 0);
  const canSave = hasMeaningfulValue && !emailError && !websiteError;
  const hasPersonDetails = [draft.given_name, draft.family_name].some((value) => value.trim().length > 0);
  const hasOrganizationDetails = [draft.organization_name, draft.company_name, draft.title, draft.team_id].some((value) => value.trim().length > 0);
  const hasMoreContactDetails = [draft.website, draft.address, draft.note].some((value) => value.trim().length > 0);
  const [addedSections, setAddedSections] = useState<Record<AddableSection, boolean>>({ person: false, organization: false, more: false });
  const visibleSections = {
    person: addedSections.person || hasPersonDetails,
    organization: addedSections.organization || hasOrganizationDetails,
    more: addedSections.more || hasMoreContactDetails
  };
  const availableSections = addableSections.filter((section) => !visibleSections[section.id]);

  useEffect(() => {
    setAddedSections({ person: false, organization: false, more: false });
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
        <CommandButton icon={Save} onClick={onSave} loading={busy} disabled={!canSave} primary>Save</CommandButton>
        <CommandButton icon={X} onClick={onCancel}>Close</CommandButton>
      </div>
    </form>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}
