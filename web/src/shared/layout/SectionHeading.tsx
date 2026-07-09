import type { ReactNode } from "react";

type SectionHeadingLevel = "h2" | "h3" | "h4";

export function SectionHeading({
  eyebrow,
  title,
  level = "h3",
  className = "",
  action
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  level?: SectionHeadingLevel;
  className?: string;
  action?: ReactNode;
}) {
  const Heading = level;
  const classes = ["section-heading", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="section-heading-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
      </div>
      {action ? <div className="section-heading-action">{action}</div> : null}
    </div>
  );
}
