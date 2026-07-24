import { useEffect, useState, type FormEvent } from "react";
import { FolderPlus, X } from "lucide-react";

import { FieldMessage } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import type { PlanningProjectCreateRequest } from "./planningContracts";

type ProjectDraft = Required<PlanningProjectCreateRequest>;

export function PlanningProjectCreateDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: PlanningProjectCreateRequest) => Promise<void>;
}) {
  const { t } = useUokLocalization();
  const [draft, setDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [submitted, setSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");
  const errors = projectDraftErrors(draft, t);

  useEffect(() => {
    if (!open) return;
    setDraft(defaultProjectDraft());
    setSubmitted(false);
    setRequestError("");
  }, [open]);

  return (
    <WorkspaceEditorPopup
      open={open}
      label={t("planning.projectCreate.dialogLabel", "New project")}
      title={t("planning.projectCreate.title", "Create project")}
      description={t("planning.projectCreate.description", "Start with the project commitment. Tasks and dependencies can be added after the validated schedule opens.")}
      onClose={onClose}
      dismissible={!busy}
      size="default"
      className="planning-project-create-dialog"
    >
      <form className="planning-project-create-form" aria-label={t("planning.projectCreate.formLabel", "New project form")} onSubmit={submitProject} noValidate>
        <p className="planning-project-create-hint">{t("planning.projectCreate.hint", "Target finish is the committed date; Planning calculates schedule finish separately.")}</p>
        <div className="planning-project-create-fields">
          <label htmlFor="planning-project-name" className={submitted && errors.name ? "field invalid planning-project-create-name" : "field planning-project-create-name"}>
            <span>{t("planning.projectCreate.name", "Project name")}</span>
            <input
              id="planning-project-name"
              value={draft.name}
              minLength={2}
              maxLength={180}
              required
              autoComplete="off"
              aria-label={t("planning.projectCreate.name", "Project name")}
              aria-invalid={submitted && errors.name ? true : undefined}
              aria-describedby={submitted && errors.name ? "planning-project-name-error" : undefined}
              onChange={(event) => updateDraft("name", event.target.value)}
            />
            {submitted && errors.name ? <FieldMessage id="planning-project-name-error">{errors.name}</FieldMessage> : null}
          </label>
          <label htmlFor="planning-project-start" className={submitted && errors.start ? "field invalid" : "field"}>
            <span>{t("planning.projectCreate.start", "Start date")}</span>
            <input
              id="planning-project-start"
              type="date"
              value={draft.start}
              required
              aria-label={t("planning.projectCreate.start", "Start date")}
              aria-invalid={submitted && errors.start ? true : undefined}
              aria-describedby={submitted && errors.start ? "planning-project-start-error" : undefined}
              onChange={(event) => updateDraft("start", event.target.value)}
            />
            {submitted && errors.start ? <FieldMessage id="planning-project-start-error">{errors.start}</FieldMessage> : null}
          </label>
          <label htmlFor="planning-project-finish" className={submitted && errors.end ? "field invalid" : "field"}>
            <span>{t("planning.projectCreate.finish", "Target finish")}</span>
            <input
              id="planning-project-finish"
              type="date"
              value={draft.end}
              min={draft.start || undefined}
              required
              aria-label={t("planning.projectCreate.finish", "Target finish")}
              aria-invalid={submitted && errors.end ? true : undefined}
              aria-describedby={submitted && errors.end ? "planning-project-finish-error" : undefined}
              onChange={(event) => updateDraft("end", event.target.value)}
            />
            {submitted && errors.end ? <FieldMessage id="planning-project-finish-error">{errors.end}</FieldMessage> : null}
          </label>
          <label htmlFor="planning-project-timezone" className={submitted && errors.timezone ? "field invalid planning-project-create-timezone" : "field planning-project-create-timezone"}>
            <span>{t("planning.projectCreate.timezone", "Time zone")}</span>
            <input
              id="planning-project-timezone"
              value={draft.timezone}
              maxLength={80}
              required
              autoComplete="off"
              aria-label={t("planning.projectCreate.timezone", "Time zone")}
              aria-invalid={submitted && errors.timezone ? true : undefined}
              aria-describedby={submitted && errors.timezone ? "planning-project-timezone-error" : "planning-project-timezone-hint"}
              onChange={(event) => updateDraft("timezone", event.target.value)}
            />
            {submitted && errors.timezone
              ? <FieldMessage id="planning-project-timezone-error">{errors.timezone}</FieldMessage>
              : <small id="planning-project-timezone-hint">{t("planning.projectCreate.timezoneHint", "Use an IANA time zone such as UTC or Asia/Kolkata.")}</small>}
          </label>
        </div>
        {requestError ? <p className="planning-project-create-error" role="alert">{requestError}</p> : null}
        <div className="planning-project-create-actions">
          <CommandButton icon={FolderPlus} type="submit" loading={busy} disabled={busy} primary>{t("planning.projectCreate.create", "Create project")}</CommandButton>
          <CommandButton icon={X} onClick={onClose} disabled={busy}>{t("planning.projectCreate.cancel", "Cancel")}</CommandButton>
        </div>
      </form>
    </WorkspaceEditorPopup>
  );

  function updateDraft(field: keyof ProjectDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setRequestError("");
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setRequestError("");
    const firstInvalidField = (["name", "start", "end", "timezone"] as const).find((field) => Boolean(errors[field]));
    if (firstInvalidField || busy) {
      if (firstInvalidField) document.getElementById(projectFieldId(firstInvalidField))?.focus();
      return;
    }
    try {
      await onCreate({
        name: draft.name.trim(),
        start: draft.start,
        end: draft.end,
        timezone: draft.timezone.trim(),
      });
      onClose();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t("planning.projectCreate.error.generic", "Project could not be created."));
    }
  }
}

function projectDraftErrors(draft: ProjectDraft, t: (key: string, fallback?: string) => string) {
  const name = draft.name.trim();
  return {
    name: name.length < 2 ? t("planning.projectCreate.error.name", "Enter a project name with at least 2 characters.") : "",
    start: draft.start ? "" : t("planning.projectCreate.error.start", "Choose a project start date."),
    end: !draft.end
      ? t("planning.projectCreate.error.finishRequired", "Choose a target finish date.")
      : draft.start && draft.end < draft.start ? t("planning.projectCreate.error.finishOrder", "Target finish must be on or after the start date.") : "",
    timezone: draft.timezone.trim() ? "" : t("planning.projectCreate.error.timezone", "Enter the project time zone."),
  };
}

function projectFieldId(field: keyof ProjectDraft) {
  return `planning-project-${field === "end" ? "finish" : field}`;
}

function defaultProjectDraft(): ProjectDraft {
  const start = new Date();
  const finish = new Date(start);
  finish.setDate(finish.getDate() + 28);
  return {
    name: "",
    start: localDate(start),
    end: localDate(finish),
    timezone: browserTimezone(),
  };
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
