import { useEffect, useState } from "react";

import {
  appearanceKey,
  contactsGroupByKey,
  contactsViewKey,
  sidebarCollapsedKey
} from "../shared/session";
import { readStorageString, writeStorageString } from "../shared/storage";
import type { Appearance, ContactGroupBy, ContactsView } from "../shared/types";

export function useWorkbenchPreferences() {
  const [appearance, setAppearance] = useState<Appearance>(() => readPreference(appearanceKey, "system", ["dark", "light", "system"]));
  const [contactsView, setContactsView] = useState<ContactsView>(() => readPreference(contactsViewKey, "split", ["cards", "quality", "split", "table"]));
  const [contactGroupBy, setContactGroupBy] = useState<ContactGroupBy>(() => readPreference(contactsGroupByKey, "none", ["none", "organization", "review_state", "source", "type"]));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStorageString("local", sidebarCollapsedKey) === "true");

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    writeStorageString("local", appearanceKey, appearance);
  }, [appearance]);

  useEffect(() => {
    writeStorageString("local", contactsViewKey, contactsView);
  }, [contactsView]);

  useEffect(() => {
    writeStorageString("local", contactsGroupByKey, contactGroupBy);
  }, [contactGroupBy]);

  useEffect(() => {
    writeStorageString("local", sidebarCollapsedKey, String(sidebarCollapsed));
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

function readPreference<T extends string>(key: string, fallback: T, allowedValues: T[]) {
  const value = readStorageString("local", key, fallback);
  return allowedValues.includes(value as T) ? value as T : fallback;
}
