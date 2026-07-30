import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

import { useUokLocalization } from "../localization";
import { ConfirmationDialog } from "../overlays";
import { CommandButton } from "../primitives";

export function ConfirmCommandButton({
  icon,
  children,
  message,
  onConfirm,
  dialogLabel,
  title,
  confirmLabel,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  disabled = false,
  destructive = false,
  loading = false,
  loadingLabel,
}: {
  icon: ElementType;
  children: ReactNode;
  message: string;
  onConfirm: (reason?: string) => void | Promise<void>;
  dialogLabel?: string;
  title?: string;
  confirmLabel?: ReactNode;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}) {
  const { t } = useUokLocalization();
  const [open, setOpen] = useState(false);
  const triggerContainerRef = useRef<HTMLSpanElement>(null);
  const restoreTriggerFocusRef = useRef(false);

  useEffect(() => {
    if (open || !restoreTriggerFocusRef.current) return undefined;
    restoreTriggerFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      triggerContainerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <>
      <span ref={triggerContainerRef} className="confirm-command-trigger">
        <CommandButton
          icon={icon}
          onClick={() => {
            restoreTriggerFocusRef.current = true;
            setOpen(true);
          }}
          disabled={disabled}
          destructive={destructive}
          loading={loading}
          loadingLabel={loadingLabel}
        >
          {children}
        </CommandButton>
      </span>
      <ConfirmationDialog
        open={open}
        label={dialogLabel ?? t("command.confirm", "Confirm action")}
        title={title ?? dialogLabel ?? t("command.confirm", "Confirm action")}
        description={message}
        confirmLabel={confirmLabel ?? children}
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
        icon={icon}
        reasonLabel={reasonLabel}
        reasonPlaceholder={reasonPlaceholder}
        reasonRequired={reasonRequired}
        destructive={destructive}
        loading={loading}
        loadingLabel={loadingLabel}
      />
    </>
  );
}
