import { useEffect, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import type { LocationDefinition, LocationDraft, LocationType } from "./types";
import { draftFromLocation, emptyLocationDraft } from "./types";

export function LocationEditor({
  mode,
  location,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  location: LocationDefinition | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: LocationDraft) => void;
}) {
  const [draft, setDraft] = useState<LocationDraft>(() => initialDraft(mode, location));
  const validationId = "location-editor-validation";
  const countryCodeValid = /^[A-Za-z]{2}$/.test(draft.countryCode.trim());
  const valid = Boolean(draft.code.trim() && draft.canonicalName.trim() && countryCodeValid);

  useEffect(() => {
    setDraft(initialDraft(mode, location));
  }, [mode, location?.id, location?.version]);

  return (
    <form
      className="location-editor-form"
      aria-label={mode === "create" ? "Create location definition" : "Edit location definition"}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onSubmit(draft);
      }}
    >
      <div className="location-editor-grid">
        <label className="field">
          <span>Location code</span>
          <input
            autoFocus={mode === "create"}
            value={draft.code}
            maxLength={80}
            required
            disabled={busy || mode === "edit"}
            aria-describedby={!draft.code.trim() ? validationId : undefined}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Canonical name</span>
          <input
            autoFocus={mode === "edit"}
            value={draft.canonicalName}
            maxLength={180}
            required
            disabled={busy}
            aria-describedby={!draft.canonicalName.trim() ? validationId : undefined}
            onChange={(event) => setDraft({ ...draft, canonicalName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Location type</span>
          <select
            value={draft.locationType}
            required
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, locationType: event.target.value as LocationType })}
          >
            <option value="port">Port</option>
            <option value="warehouse">Warehouse</option>
            <option value="city">City</option>
            <option value="region">Region</option>
          </select>
        </label>
        <label className="field">
          <span>Country code</span>
          <input
            value={draft.countryCode}
            minLength={2}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            required
            disabled={busy}
            aria-describedby={!countryCodeValid ? validationId : undefined}
            onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })}
          />
        </label>
        {mode === "edit" ? (
          <label className="field location-editor-wide-field">
            <span>Name-change reason</span>
            <input
              value={draft.reason}
              maxLength={500}
              disabled={busy}
              placeholder="Optional unless more context is needed"
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </label>
        ) : null}
      </div>
      {!valid ? <FieldMessage id={validationId}>Code, canonical name, type, and a two-letter country code are required.</FieldMessage> : null}
      {error ? <FieldMessage id="location-editor-error">{error}</FieldMessage> : null}
      <div className="location-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          labelKey={mode === "create" ? "command.createLocation" : "command.saveLocation"}
          fallbackLabel={mode === "create" ? "Create location" : "Save location"}
          type="submit"
          primary
          loading={busy}
          disabled={!valid}
        />
      </div>
    </form>
  );
}

function initialDraft(mode: "create" | "edit", location: LocationDefinition | null) {
  return mode === "edit" && location ? draftFromLocation(location) : { ...emptyLocationDraft };
}
