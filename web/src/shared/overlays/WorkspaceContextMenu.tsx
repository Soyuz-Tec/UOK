import { useEffect, useRef, type CSSProperties, type ElementType } from "react";

export type WorkspaceContextMenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ElementType;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function WorkspaceContextMenu({
  label,
  items,
  onClose,
  open,
  position,
}: {
  label: string;
  items: WorkspaceContextMenuItem[];
  onClose: () => void;
  open: boolean;
  position: { x: number; y: number };
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    const closeFromDocument = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("mousedown", closeFromDocument);
    document.addEventListener("keydown", closeFromDocument);
    return () => {
      document.removeEventListener("mousedown", closeFromDocument);
      document.removeEventListener("keydown", closeFromDocument);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="workspace-context-menu"
      role="menu"
      aria-label={label}
      style={{ "--context-menu-x": `${position.x}px`, "--context-menu-y": `${position.y}px` } as CSSProperties}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={item.destructive ? "destructive" : ""}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>
              <strong>{item.label}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
