import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { useUokLocalization } from "../localization";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function isolateBackground(backdrop: HTMLElement) {
  const isolated: Array<{
    element: HTMLElement;
    ariaHidden: string | null;
    inert: string | null;
  }> = [];
  let current: HTMLElement | null = backdrop;

  while (current) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;

    for (const sibling of Array.from(parent.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement)) continue;
      isolated.push({
        element: sibling,
        ariaHidden: sibling.getAttribute("aria-hidden"),
        inert: sibling.getAttribute("inert")
      });
      sibling.setAttribute("aria-hidden", "true");
      sibling.setAttribute("inert", "");
    }

    if (parent === document.body) break;
    current = parent;
  }

  return () => {
    for (const snapshot of isolated.reverse()) {
      if (snapshot.ariaHidden === null) snapshot.element.removeAttribute("aria-hidden");
      else snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);

      if (snapshot.inert === null) snapshot.element.removeAttribute("inert");
      else snapshot.element.setAttribute("inert", snapshot.inert);
    }
  };
}

export function WorkspacePopup({
  open,
  label,
  onClose,
  children,
  size = "default",
  className = "",
  dismissible = true
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  size?: "compact" | "default" | "wide";
  className?: string;
  dismissible?: boolean;
}) {
  const { t } = useUokLocalization();
  const backdropRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreBackground = backdropRef.current ? isolateBackground(backdropRef.current) : () => undefined;
    const popup = popupRef.current;
    const initialFocus = dismissibleRef.current ? closeButtonRef.current : popup ? focusableElements(popup)[0] : null;
    (initialFocus || popup)?.focus();

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!dismissibleRef.current) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !popupRef.current) return;
      const focusable = focusableElements(popupRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        popupRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !popupRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !popupRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
      restoreBackground();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="workspace-popup-backdrop"
      role="presentation"
      ref={backdropRef}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`workspace-popup workspace-popup-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={popupRef}
        tabIndex={-1}
      >
        <button
          type="button"
          className="workspace-popup-close"
          aria-label={`${t("command.close", "Close")} ${label}`}
          onClick={onClose}
          ref={closeButtonRef}
          disabled={!dismissible}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="workspace-popup-content">
          {children}
        </div>
      </section>
    </div>
  );
}
