import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function WorkspacePopup({
  open,
  label,
  onClose,
  children,
  size = "default",
  className = ""
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  size?: "compact" | "default" | "wide";
  className?: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("keydown", closeFromKeyboard);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="workspace-popup-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`workspace-popup workspace-popup-${size} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="workspace-popup-close" aria-label={`Close ${label}`} onClick={onClose} ref={closeButtonRef}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="workspace-popup-content">
          {children}
        </div>
      </section>
    </div>
  );
}
