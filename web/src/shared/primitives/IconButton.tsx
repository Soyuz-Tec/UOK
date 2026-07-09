import type { ElementType } from "react";

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  primary = false,
  selected = false,
  title = label,
  type = "button"
}: {
  icon: ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  selected?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const className = [
    "icon-button",
    primary ? "primary" : "",
    selected ? "selected" : ""
  ].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={className}
      aria-label={label}
      aria-pressed={selected || undefined}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
