import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { X } from "lucide-react";

import { useUokLocalization } from "../localization";
import { WorkspaceEditorPopup } from "../overlays";
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
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const triggerContainerRef = useRef<HTMLSpanElement>(null);
  const restoreTriggerFocusRef = useRef(false);
  const busy = loading || submitting;

  useEffect(() => {
    if (open || !restoreTriggerFocusRef.current) return undefined;
    restoreTriggerFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      triggerContainerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setReason("");
    setError("");
  };

  const runConfirmed = async () => {
    if (reasonRequired && !reason.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(reasonLabel ? reason.trim() : undefined);
      setOpen(false);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : t("command.actionFailed", "The action could not be completed. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <span ref={triggerContainerRef} className="confirm-command-trigger">
        <CommandButton
          icon={icon}
          onClick={() => {
            restoreTriggerFocusRef.current = true;
            setError("");
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
      <WorkspaceEditorPopup
        open={open}
        label={dialogLabel ?? t("command.confirm", "Confirm action")}
        title={title ?? dialogLabel ?? t("command.confirm", "Confirm action")}
        description={message}
        onClose={close}
        size="compact"
        className="confirm-command-popup"
        dismissible={!busy}
      >
        <div className="confirm-command-content">
          {reasonLabel ? (
            <label className="field">
              <span>{reasonLabel}</span>
              <textarea
                value={reason}
                placeholder={reasonPlaceholder}
                required={reasonRequired}
                rows={3}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}
          {error ? <p className="confirm-command-error" role="alert">{error}</p> : null}
          <div className="confirm-command-actions">
            <CommandButton icon={X} onClick={close} disabled={busy}>{t("command.cancel", "Cancel")}</CommandButton>
            <CommandButton
              icon={icon}
              onClick={() => void runConfirmed()}
              disabled={busy || (reasonRequired && !reason.trim())}
              destructive={destructive}
              loading={busy}
              loadingLabel={loadingLabel}
            >
              {confirmLabel ?? children}
            </CommandButton>
          </div>
        </div>
      </WorkspaceEditorPopup>
    </>
  );
}
