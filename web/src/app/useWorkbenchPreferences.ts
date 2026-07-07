import { useEffect, useState } from "react";

import {
  appearanceKey,
  contactsGroupByKey,
  contactsViewKey,
  sidebarCollapsedKey
} from "../shared/session";
import type { Appearance, ContactGroupBy, ContactsView } from "../shared/types";

export function useWorkbenchPreferences() {
  const [appearance, setAppearance] = useState<Appearance>(() => (localStorage.getItem(appearanceKey) as Appearance | null) || "system");
  const [contactsView, setContactsView] = useState<ContactsView>(() => (localStorage.getItem(contactsViewKey) as ContactsView | null) || "split");
  const [contactGroupBy, setContactGroupBy] = useState<ContactGroupBy>(() => (localStorage.getItem(contactsGroupByKey) as ContactGroupBy | null) || "none");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarCollapsedKey) === "true");

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    localStorage.setItem(appearanceKey, appearance);
  }, [appearance]);

  useEffect(() => {
    localStorage.setItem(contactsViewKey, contactsView);
  }, [contactsView]);

  useEffect(() => {
    localStorage.setItem(contactsGroupByKey, contactGroupBy);
  }, [contactGroupBy]);

  useEffect(() => {
    localStorage.setItem(sidebarCollapsedKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return {
    appearance,
    contactGroupBy,
    contactsView,
    setAppearance,
    setContactGroupBy,
    setContactsView,
    setSidebarCollapsed,
    sidebarCollapsed
  };
}

export type WorkbenchPreferences = ReturnType<typeof useWorkbenchPreferences>;
