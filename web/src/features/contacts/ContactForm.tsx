import { Save, X } from "lucide-react";

import type { ContactDraft } from "../../shared/types";
import { CommandButton } from "../../shared/ui";

export function ContactForm({ draft, onChange, onSave, onCancel, busy }: {
  draft: ContactDraft;
  onChange: (draft: ContactDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const setField = (field: keyof ContactDraft, value: string) => onChange({ ...draft, [field]: value });
  return (
    <form className="contact-form" aria-label="Contact form" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="form-section">
        <legend>Identity</legend>
        <div className="form-field-grid">
          <label className="field">
            <span>Type</span>
            <select value={draft.party_type} onChange={(event) => setField("party_type", event.target.value as ContactDraft["party_type"])}>
              <option value="person">Person</option>
              <option value="organization">Organization</option>
            </select>
          </label>
          <label className="field field-prominent"><span>Display name</span><input value={draft.display_name} onChange={(event) => setField("display_name", event.target.value)} /></label>
          <label className="field"><span>Given name</span><input value={draft.given_name} onChange={(event) => setField("given_name", event.target.value)} /></label>
          <label className="field"><span>Family name</span><input value={draft.family_name} onChange={(event) => setField("family_name", event.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Contact methods</legend>
        <div className="form-field-grid">
          <label className="field"><span>Email</span><input value={draft.email} onChange={(event) => setField("email", event.target.value)} /></label>
          <label className="field"><span>Phone</span><input value={draft.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
          <label className="field"><span>Website</span><input value={draft.website} onChange={(event) => setField("website", event.target.value)} /></label>
          <label className="field field-wide"><span>Address</span><input value={draft.address} onChange={(event) => setField("address", event.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Organization</legend>
        <div className="form-field-grid">
          <label className="field"><span>Organization</span><input value={draft.organization_name} onChange={(event) => setField("organization_name", event.target.value)} /></label>
          <label className="field"><span>Company link</span><input value={draft.company_name} onChange={(event) => setField("company_name", event.target.value)} /></label>
          <label className="field"><span>Title</span><input value={draft.title} onChange={(event) => setField("title", event.target.value)} /></label>
          <label className="field"><span>Team</span><input value={draft.team_id} onChange={(event) => setField("team_id", event.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Internal note</legend>
        <label className="field"><span>Note</span><textarea value={draft.note} onChange={(event) => setField("note", event.target.value)} rows={3} /></label>
      </fieldset>
      <div className="form-actions">
        <CommandButton icon={Save} onClick={onSave} loading={busy} primary>Save</CommandButton>
        <CommandButton icon={X} onClick={onCancel}>Close</CommandButton>
      </div>
    </form>
  );
}
