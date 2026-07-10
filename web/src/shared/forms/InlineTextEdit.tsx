import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";

import { CommandButton } from "../primitives";
import { FieldMessage } from "./FieldMessage";

export function InlineTextEdit({
  label,
  value,
  onCommit,
  validate,
  failureMessage = "Could not save. Try again.",
  disabled = false
}: {
  label: string;
  value: string;
  onCommit: (value: string) => Promise<void> | void;
  validate?: (value: string) => string;
  failureMessage?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const displayRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const inputId = useId();
  const errorId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-inline-error`;

  useEffect(() => {
    if (!editing && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      displayRef.current?.focus();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(value);
    setError("");
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setError("");
    finishEditing();
  };

  const finishEditing = () => {
    restoreFocusRef.current = true;
    setEditing(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const nextValue = draft.trim();
    const validationError = validate?.(nextValue) || "";
    if (validationError) {
      setError(validationError);
      return;
    }
    if (nextValue === value.trim()) {
      finishEditing();
      return;
    }
    setSaving(true);
    try {
      await onCommit(nextValue);
      finishEditing();
    } catch {
      setError(failureMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button ref={displayRef} type="button" className="inline-edit-display" onClick={startEditing} disabled={disabled} aria-label={`Edit ${label}`}>
        <span>{value || "Not set"}</span>
        <Pencil size={15} aria-hidden="true" />
      </button>
    );
  }

  return (
    <form className="inline-edit-form" onSubmit={save}>
      <label className={error ? "field invalid" : "field"} htmlFor={inputId}>
        <span>{label}</span>
        <input
          id={inputId}
          value={draft}
          aria-label={label}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
        {error && <FieldMessage id={errorId}>{error}</FieldMessage>}
      </label>
      <div className="inline-edit-actions">
        <CommandButton icon={Check} type="submit" loading={saving} primary>Save</CommandButton>
        <CommandButton icon={X} onClick={cancel} disabled={saving}>Cancel</CommandButton>
      </div>
    </form>
  );
}
