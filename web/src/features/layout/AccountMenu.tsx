import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, RefreshCw } from "lucide-react";

import { appearanceOptions } from "../../shared/options";
import { formatLabel } from "../../shared/format";
import { uokLocaleOptions, useUokLocalization } from "../../shared/localization";
import { ConfirmationDialog } from "../../shared/overlays";
import type { Appearance, SessionUser, UokLocale } from "../../shared/types";

export function AccountMenu({ user, appearance, locale, busy, onAppearanceChange, onLocaleChange, onRefresh, onSignOut }: {
  user: SessionUser | null;
  appearance: Appearance;
  locale: UokLocale;
  busy: boolean;
  onAppearanceChange: (value: Appearance) => void;
  onLocaleChange: (value: UokLocale) => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const { t } = useUokLocalization();
  const [expanded, setExpanded] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuFocusTimerRef = useRef<number | null>(null);
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
    menuFocusTimerRef.current = window.setTimeout(() => {
      menuFocusTimerRef.current = null;
      firstMenuButton?.focus();
    }, 0);

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeMenu();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      if (menuFocusTimerRef.current !== null) {
        window.clearTimeout(menuFocusTimerRef.current);
        menuFocusTimerRef.current = null;
      }
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeMenu, expanded]);

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
    <footer ref={rootRef} className={`account-menu-root${expanded ? " expanded" : ""}`} aria-label={t("account.controls")}>
      {expanded && (
        <div id={menuId} ref={menuRef} className="session-popover" role="menu" aria-label={t("account.menu")} onKeyDown={onMenuKeyDown}>
          <div className="session-menu-appearance" role="group" aria-label={t("account.appearance")}>
            <div className="session-appearance-options" role="group" aria-label={t("account.appearance")}>
              {appearanceOptions.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="menuitemradio" className={appearance === id ? "selected" : ""} aria-checked={appearance === id} onClick={() => onAppearanceChange(id)}>
                  <Icon size={13} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="session-menu-locale" role="group" aria-label={t("account.language")}>
            <div className="session-locale-options">
              {uokLocaleOptions.map((option) => (
                <button key={option.id} type="button" role="menuitemradio" className={locale === option.id ? "selected" : ""} aria-checked={locale === option.id} lang={option.id} dir={option.direction} onClick={() => onLocaleChange(option.id)}>{option.label}</button>
              ))}
            </div>
          </div>
          <div className="session-menu-divider" />
          <button type="button" role="menuitem" className="session-menu-button" onClick={onRefresh} disabled={busy} aria-busy={busy || undefined}>
            <RefreshCw size={16} aria-hidden="true" />
            <span>{t("account.refresh")}</span>
          </button>
          <div className="session-menu-divider" />
          <button type="button" role="menuitem" className="session-menu-button destructive" onClick={() => {
            if (menuFocusTimerRef.current !== null) {
              window.clearTimeout(menuFocusTimerRef.current);
              menuFocusTimerRef.current = null;
            }
            setConfirmingLogout(true);
          }}>
            <LogOut size={16} aria-hidden="true" />
            <span>{t("account.logout")}</span>
          </button>
        </div>
      )}
      <button ref={triggerRef} type="button" className="session-user-trigger" aria-expanded={expanded} aria-controls={menuId} aria-label={`${expanded ? t("account.close") : t("account.open")} ${displayName}`} onClick={() => setExpanded((value) => !value)}>
        <span className="account-avatar" aria-hidden="true">{initial}</span>
        <span className="account-meta" aria-hidden="true">
          <strong>{displayName}</strong>
          <small>{triggerDetail}</small>
        </span>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      <ConfirmationDialog
        open={confirmingLogout}
        icon={LogOut}
        label={t("account.logout")}
        title={t("account.logout")}
        description={t("account.endSession")}
        confirmLabel={t("account.logout")}
        cancelLabel={t("account.cancel")}
        onClose={() => setConfirmingLogout(false)}
        onConfirm={onSignOut}
        destructive
      />
    </footer>
  );
}
