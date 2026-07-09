import type { ButtonHTMLAttributes, ElementType, ReactNode } from "react";

export function ToggleButton({
  icon: Icon,
  children,
  className = "",
  disabled = false,
  onClick,
  pressed,
  title,
  ...props
}: {
  icon: ElementType;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  pressed?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ["toggle-button", pressed ? "selected" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} aria-pressed={pressed} title={title} onClick={onClick} disabled={disabled} {...props}>
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}
