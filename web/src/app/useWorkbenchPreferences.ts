import { useEffect, useState } from "react";

import {
  appearanceKey,
  contactsViewKey,
  sidebarCollapsedKey
} from "../shared/session";
import type { Appearance, ContactsView } from "../shared/types";

export function useWorkbenchPreferences() {
  const [appearance, setAppearance] = useState<Appearance>(() => (localStorage.getItem(appearanceKey) as Appearance | null) || "system");
  const [contactsView, setContactsView] = useState<ContactsView>(() => (localStorage.getItem(contactsViewKey) as ContactsView | null) || "split");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarCollapsedKey) === "true");

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    localStorage.setItem(appearanceKey, appearance);
  }, [appearance]);

  useEffect(() => {
    localStorage.setItem(contactsViewKey, contactsView);
  }, [contactsView]);

  useEffect(() => {
    localStorage.setItem(sidebarCollapsedKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return {
    appearance,
    contactsView,
    setAppearance,
    setContactsView,
    setSidebarCollapsed,
    sidebarCollapsed
  };
}
