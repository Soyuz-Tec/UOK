import type { ElementType, ReactNode } from "react";

import { CommandButton } from "../primitives";

export function ConfirmCommandButton({
  icon,
  children,
  message,
  onConfirm,
  disabled = false,
  destructive = false,
  loading = false,
  loadingLabel,
}: {
  icon: ElementType;
  children: ReactNode;
  message: string;
  onConfirm: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}) {
  const runConfirmed = () => {
    if (globalThis.confirm(message)) onConfirm();
  };
  return (
    <CommandButton icon={icon} onClick={runConfirmed} disabled={disabled} destructive={destructive} loading={loading} loadingLabel={loadingLabel}>
      {children}
    </CommandButton>
  );
}
