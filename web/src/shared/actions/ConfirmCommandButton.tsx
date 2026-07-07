import type { ElementType, ReactNode } from "react";

import { CommandButton } from "../primitives";

export function ConfirmCommandButton({
  icon,
  children,
  message,
  onConfirm,
  disabled = false,
  destructive = false
}: {
  icon: ElementType;
  children: ReactNode;
  message: string;
  onConfirm: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const runConfirmed = () => {
    if (globalThis.confirm(message)) onConfirm();
  };
  return (
    <CommandButton icon={icon} onClick={runConfirmed} disabled={disabled} destructive={destructive}>
      {children}
    </CommandButton>
  );
}
