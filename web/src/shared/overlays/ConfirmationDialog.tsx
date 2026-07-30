import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { X } from "lucide-react";

import { useUokLocalization } from "../localization";
import { CommandButton } from "../primitives";
import { WorkspaceEditorPopup } from "./WorkspaceEditorPopup";

export function ConfirmationDialog({
  open,
  icon,
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  cancelLabel,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  destructive = false,
  loading = false,
  loadingLabel,
}: {
  open: boolean;
  icon: ElementType;
  label: string;
  title: string;
  description: string;
  confirmLabel: ReactNode;
  onConfirm: (reason?: string) => void | Promise<void>;
  onClose: () => void;
  cancelLabel?: ReactNode;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  destructive?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}) {
  const { t } = useUokLocalization();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const busy = loading || submitting;

  useEffect(() => {
    if (open) return;
    setReason("");
    setError("");
    setSubmitting(false);
  }, [open]);

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    if (reasonRequired && !reason.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(reasonLabel ? reason.trim() : undefined);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? cause.message
        : t("command.actionFailed", "The action could not be completed. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceEditorPopup
      open={open}
      label={label}
      title={title}
      description={description}
      onClose={close}
      size="compact"
      className="confirm-command-popup"
      dismissible={!busy}
      dialogRole="alertdialog"
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
          <CommandButton icon={X} onClick={close} disabled={busy}>
            {cancelLabel ?? t("command.cancel", "Cancel")}
          </CommandButton>
          <CommandButton
            icon={icon}
            onClick={() => void confirm()}
            disabled={busy || (reasonRequired && !reason.trim())}
            destructive={destructive}
            loading={busy}
            loadingLabel={loadingLabel}
          >
            {confirmLabel}
          </CommandButton>
        </div>
      </div>
    </WorkspaceEditorPopup>
  );
}
