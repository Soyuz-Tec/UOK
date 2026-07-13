import type { ElementType, ReactNode } from "react";

import { useUokLocalization } from "../localization";

export type CommandButtonProps = {
  icon: ElementType;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
  primary?: boolean;
  destructive?: boolean;
  type?: "button" | "submit";
  className?: string;
  "data-command"?: string;
  "aria-label"?: string;
  "aria-keyshortcuts"?: string;
  title?: string;
};

export function CommandButton({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  loading = false,
  loadingLabel,
  primary = false,
  destructive = false,
  type = "button",
  className = "",
  "data-command": dataCommand,
  "aria-label": ariaLabel,
  "aria-keyshortcuts": ariaKeyShortcuts,
  title,
}: CommandButtonProps) {
  const { t } = useUokLocalization();
  const buttonClassName = [
    "command-button",
    primary ? "primary" : "",
    destructive ? "destructive" : "",
    loading ? "loading" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button
      type={type}
      className={buttonClassName}
      data-command={dataCommand}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyShortcuts}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{loading ? loadingLabel ?? t("command.working", "Working") : children}</span>
    </button>
  );
}
