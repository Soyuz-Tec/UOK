import { ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useUokLocalization } from "../localization";

type PanelChildren = ReactNode | ((controls: { close: () => void }) => ReactNode);

const FOCUSABLE_SELECTOR = [
  "input:not(:disabled):not([tabindex='-1'])",
  "select:not(:disabled):not([tabindex='-1'])",
  "button:not(:disabled):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function ExpandableControlPanel({
  label,
  triggerLabel,
  triggerSummary,
  triggerIcon: TriggerIcon,
  initialFocusSelector,
  className,
  panelClassName,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  label: string;
  triggerLabel: string;
  triggerSummary: ReactNode;
  triggerIcon?: LucideIcon;
  initialFocusSelector?: string;
  className?: string;
  panelClassName?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: PanelChildren;
}) {
  const { t } = useUokLocalization();
  const generatedId = useId();
  const panelId = `expandable-control-panel-${generatedId.replaceAll(":", "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [compactPresentation, setCompactPresentation] = useState(false);
  const isOpen = open ?? internalOpen;

  const setOpen = (nextOpen: boolean, restoreFocus = false) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen && restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 680px)");
    if (!media) return undefined;
    const updatePresentation = () => setCompactPresentation(media.matches);
    updatePresentation();
    media.addEventListener?.("change", updatePresentation);
    return () => media.removeEventListener?.("change", updatePresentation);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const clampToViewport = () => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.style.transform = "";
      const rect = panel.getBoundingClientRect();
      const margin = 12;
      const viewportWidth = document.documentElement.clientWidth;
      const shift = rect.left < margin
        ? margin - rect.left
        : rect.right > viewportWidth - margin
          ? viewportWidth - margin - rect.right
          : 0;
      panel.style.transform = shift ? `translateX(${shift}px)` : "";
    };
    clampToViewport();
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen || wasOpen) return;
    queueMicrotask(() => {
      const panel = panelRef.current;
      const preferredControl = initialFocusSelector
        ? panel?.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const firstControl = preferredControl || panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstControl || panel)?.focus();
    });
  }, [initialFocusSelector, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeFromOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false, true);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const nestedOpenPanel = rootRef.current?.querySelector<HTMLElement>('.expandable-control-panel[data-open="true"]');
        if (nestedOpenPanel?.contains(document.activeElement)) return;
        event.preventDefault();
        setOpen(false, true);
        return;
      }
      if (event.key !== "Tab" || !compactPresentation) return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [compactPresentation, initialFocusSelector, isOpen, onOpenChange, open]);

  const close = () => setOpen(false, true);

  return (
    <div ref={rootRef} className={["expandable-control-panel", className].filter(Boolean).join(" ")} data-open={isOpen ? "true" : "false"}>
      <button
        ref={triggerRef}
        type="button"
        className="expandable-control-trigger"
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        onClick={() => setOpen(!isOpen)}
      >
        {TriggerIcon ? <TriggerIcon size={16} aria-hidden="true" /> : null}
        <span>{triggerSummary}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className="expandable-control-scrim" aria-label={`${t("command.close", "Close")} ${label}`} onClick={close} />
      <div ref={panelRef} id={panelId} className={["expandable-control-surface", panelClassName].filter(Boolean).join(" ")} role="dialog" aria-label={label} aria-modal={compactPresentation ? "true" : "false"} tabIndex={-1}>
        {typeof children === "function" ? children({ close }) : children}
      </div>
    </div>
  );
}
