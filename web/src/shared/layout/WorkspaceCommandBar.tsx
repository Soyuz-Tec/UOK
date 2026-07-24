import type { ReactNode } from "react";
import { useUokLocalization } from "../localization";

export type WorkspaceCommandBarProps = {
  label: string;
  className?: string;
  query?: ReactNode;
  context?: ReactNode;
  pagination?: ReactNode;
  view?: ReactNode;
  fields?: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
};

export function WorkspaceCommandBar({
  label,
  className = "",
  query,
  context,
  pagination,
  view,
  fields,
  secondaryActions,
  primaryAction,
}: WorkspaceCommandBarProps) {
  const { t } = useUokLocalization();
  const hasContext = Boolean(context || pagination);
  const hasActions = Boolean(view || fields || secondaryActions || primaryAction);

  return (
    <section className={`workspace-command-bar ${className}`.trim()} aria-label={label}>
      {query ? (
        <div className="workspace-command-bar-group workspace-command-bar-query" role="group" aria-label={`${label} ${t("command.query", "query")}`}>
          {query}
        </div>
      ) : null}
      {hasContext ? (
        <div className="workspace-command-bar-group workspace-command-bar-context" role="group" aria-label={`${label} ${t("command.context", "context")}`}>
          {context}
          {pagination}
        </div>
      ) : null}
      {hasActions ? (
        <div className="workspace-command-bar-group workspace-command-bar-actions" role="group" aria-label={`${label} ${t("command.actions", "actions")}`}>
          {view}
          {fields}
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}
