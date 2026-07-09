import type { ReactNode } from "react";

export function WorkflowSplitView({
  primaryLabel,
  secondaryLabel,
  primary,
  secondary
}: {
  primaryLabel: string;
  secondaryLabel: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  const classes = ["workflow-split-view", secondary ? "" : "single-pane"].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <section className="workflow-primary-region" aria-label={primaryLabel}>
        {primary}
      </section>
      {secondary ? <aside className="workflow-secondary-region" aria-label={secondaryLabel}>{secondary}</aside> : null}
    </div>
  );
}
