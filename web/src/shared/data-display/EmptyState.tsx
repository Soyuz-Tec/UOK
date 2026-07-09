export function EmptyState({
  ariaLabel,
  text,
  title,
  className = "",
}: {
  ariaLabel?: string;
  text: string;
  title?: string;
  className?: string;
}) {
  const classes = ["empty-state", className].filter(Boolean).join(" ");
  return (
    <div className={classes} aria-label={ariaLabel}>
      {title ? <strong>{title}</strong> : null}
      <span>{text}</span>
    </div>
  );
}
