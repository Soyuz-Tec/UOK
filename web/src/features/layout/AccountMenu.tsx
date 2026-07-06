import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, RefreshCw } from "lucide-react";

import { appearanceOptions } from "../../shared/options";
import { formatLabel } from "../../shared/format";
import type { Appearance, SessionUser } from "../../shared/types";

export function AccountMenu({ user, appearance, busy, onAppearanceChange, onRefresh, onSignOut }: {
  user: SessionUser | null;
  appearance: Appearance;
  busy: boolean;
  onAppearanceChange: (value: Appearance) => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const displayName = user?.display_name || user?.username || "Signed in";
  const identity = user?.email || user?.username || "Active user";
  const initial = displayName.slice(0, 1).toUpperCase();
  const roleLabel = user?.role ? formatLabel(user.role) : "Session active";
  const triggerDetail = roleLabel === displayName ? identity : roleLabel;
  const menuId = "account-menu";

  const closeMenu = useCallback((returnFocus = false) => {
    setExpanded(false);
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const firstMenuButton = menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    window.setTimeout(() => firstMenuButton?.focus(), 0);

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeMenu();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeMenu, expanded]);

  useEffect(() => {
    if (confirmingLogout) window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
  }, [confirmingLogout]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || []);
    if (!focusable.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = Math.max(0, focusable.indexOf(document.activeElement as HTMLButtonElement));
      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1) % focusable.length
        : (currentIndex - 1 + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
    }

    if (event.key === "Tab") {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <footer ref={rootRef} className={`account-menu-root${expanded ? " expanded" : ""}`} aria-label="Signed in user controls">
      {expanded && (
        <div id={menuId} ref={menuRef} className="session-popover" role="menu" aria-label="Account menu" onKeyDown={onMenuKeyDown}>
          <div className="session-menu-appearance" role="group" aria-label="Appearance">
            <div className="session-appearance-options" role="group" aria-label="Appearance">
              {appearanceOptions.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="menuitemradio" className={appearance === id ? "selected" : ""} aria-checked={appearance === id} onClick={() => onAppearanceChange(id)}>
                  <Icon size={13} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="session-menu-divider" />
          <button type="button" role="menuitem" className="session-menu-button" onClick={onRefresh} disabled={busy} aria-busy={busy || undefined}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <div className="session-menu-divider" />
          <button type="button" role="menuitem" className="session-menu-button destructive" onClick={() => setConfirmingLogout(true)}>
            <LogOut size={16} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      )}
      <button ref={triggerRef} type="button" className="session-user-trigger" aria-expanded={expanded} aria-controls={menuId} aria-label={`${expanded ? "Close" : "Open"} account menu for ${displayName}`} onClick={() => setExpanded((value) => !value)}>
        <span className="account-avatar" aria-hidden="true">{initial}</span>
        <span className="account-meta">
          <strong>{displayName}</strong>
          <small>{triggerDetail}</small>
        </span>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      {confirmingLogout && (
        <div className="logout-dialog-backdrop" role="presentation">
          <section className="logout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-body">
            <div className="logout-dialog-icon" aria-hidden="true">
              <LogOut size={20} />
            </div>
            <div>
              <h2 id="logout-dialog-title">Logout</h2>
              <p id="logout-dialog-body">End this session and return to the login screen?</p>
            </div>
            <div className="logout-dialog-actions">
              <button type="button" className="command-button" onClick={() => setConfirmingLogout(false)}>Cancel</button>
              <button ref={confirmButtonRef} type="button" className="command-button destructive" onClick={() => {
                setConfirmingLogout(false);
                onSignOut();
              }}>Logout</button>
            </div>
          </section>
        </div>
      )}
    </footer>
  );
}
