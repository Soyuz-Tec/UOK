import { CircleCheckBig, RefreshCw } from "lucide-react";

import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";

type ProjectReloadFailure = {
  projectId: string;
  projectName: string;
};

export function PlanningProjectReloadNotice({ status, busy, onRetry }: {
  status: unknown;
  busy: string;
  onRetry: () => void;
}) {
  const { t } = useUokLocalization();
  const failure = planningProjectReloadFailure(status);
  if (!failure) return null;

  return (
    <section className="planning-project-reload-notice" role="status" aria-live="polite" aria-label={t("planning.projectCreate.reloadFailed.label", "Created project needs loading")}>
      <CircleCheckBig size={20} aria-hidden="true" />
      <div className="planning-project-reload-copy">
        <strong>
          {failure.projectName
            ? <><span>{failure.projectName}</span> {t("planning.projectCreate.reloadFailed.named", "was created.")}</>
            : t("planning.projectCreate.reloadFailed.title", "Project created")}
        </strong>
        <span>{t("planning.projectCreate.reloadFailed.description", "The project was saved successfully, but Planning could not load its schedule. Retry loading it instead of creating it again.")}</span>
      </div>
      <CommandButton icon={RefreshCw} onClick={onRetry} loading={busy === "refresh"} disabled={Boolean(busy)} primary>
        {t("planning.projectCreate.reloadFailed.retry", "Retry loading")}
      </CommandButton>
    </section>
  );
}

export function planningProjectReloadFailure(status: unknown): ProjectReloadFailure | null {
  if (!status || typeof status !== "object") return null;
  const row = status as Record<string, unknown>;
  if (row.status !== "created_reload_failed") return null;
  return {
    projectId: typeof row.project_id === "string" ? row.project_id : "",
    projectName: typeof row.project_name === "string" ? row.project_name : "",
  };
}
