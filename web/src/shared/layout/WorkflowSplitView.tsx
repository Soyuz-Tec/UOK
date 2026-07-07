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
  secondary: ReactNode;
}) {
  return (
    <div className="workflow-split-view">
      <section className="workflow-primary-region" aria-label={primaryLabel}>
        {primary}
      </section>
      <aside className="workflow-secondary-region" aria-label={secondaryLabel}>
        {secondary}
      </aside>
    </div>
  );
}
