import type { ReactNode } from "react";

export function WorkflowHeader({
  eyebrow,
  title,
  summary,
  status,
  children
}: {
  eyebrow: string;
  title: string;
  summary?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="workflow-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {summary && <p className="workflow-summary">{summary}</p>}
      </div>
      {(status || children) && (
        <div className="workflow-header-actions">
          {status}
          {children}
        </div>
      )}
    </div>
  );
}
