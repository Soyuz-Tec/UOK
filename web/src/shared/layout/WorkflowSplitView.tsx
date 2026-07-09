import type { ReactNode } from "react";

export function WorkflowSplitView({
  primaryLabel,
  secondaryLabel,
  primary,
  secondary,
  secondaryOpen = true,
  secondaryPresentation = "inline"
}: {
  primaryLabel: string;
  secondaryLabel: string;
  primary: ReactNode;
  secondary?: ReactNode;
  secondaryOpen?: boolean;
  secondaryPresentation?: "inline" | "slide";
}) {
  const hasSecondary = Boolean(secondary);
  const secondaryVisible = hasSecondary && secondaryOpen;
  const classes = [
    "workflow-split-view",
    secondaryPresentation === "slide" ? "secondary-slide" : "",
    secondaryVisible ? "secondary-open" : "secondary-closed",
    hasSecondary && (secondaryPresentation !== "inline" || secondaryVisible) ? "" : "single-pane",
  ].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <section className="workflow-primary-region" aria-label={primaryLabel}>
        {primary}
      </section>
      {secondary ? (
        <aside className="workflow-secondary-region" aria-label={secondaryLabel} aria-hidden={!secondaryVisible} inert={!secondaryVisible ? true : undefined}>
          {secondary}
        </aside>
      ) : null}
    </div>
  );
}
