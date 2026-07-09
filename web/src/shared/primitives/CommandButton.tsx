import type { ElementType, ReactNode } from "react";

export function CommandButton({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  loading = false,
  primary = false,
  destructive = false,
  type = "button"
}: {
  icon: ElementType;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
  destructive?: boolean;
  type?: "button" | "submit";
}) {
  const className = [
    "command-button",
    primary ? "primary" : "",
    destructive ? "destructive" : "",
    loading ? "loading" : ""
  ].filter(Boolean).join(" ");
  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
      <Icon size={16} aria-hidden="true" />
      <span>{loading ? "Working" : children}</span>
    </button>
  );
}
