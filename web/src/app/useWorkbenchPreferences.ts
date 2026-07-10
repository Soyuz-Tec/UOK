import { useEffect, useState } from "react";

import {
  appearanceKey,
  contactsGroupByKey,
  contactsViewKey,
  localeKey,
  sidebarCollapsedKey
} from "../shared/session";
import { readStorageString, writeStorageString } from "../shared/storage";
import { uokLocaleDirection } from "../shared/localization";
import type { Appearance, ContactGroupBy, ContactsView, UokLocale } from "../shared/types";

export function useWorkbenchPreferences() {
  const [appearance, setAppearance] = useState<Appearance>(() => readPreference(appearanceKey, "system", ["dark", "light", "system"]));
  const [locale, setLocale] = useState<UokLocale>(() => readPreference(localeKey, "en-US", ["en-US", "ar"]));
  const [contactsView, setContactsView] = useState<ContactsView>(() => readPreference(contactsViewKey, "split", ["cards", "quality", "split", "table"]));
  const [contactGroupBy, setContactGroupBy] = useState<ContactGroupBy>(() => readPreference(contactsGroupByKey, "none", ["none", "organization", "review_state", "source", "type"]));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStorageString("local", sidebarCollapsedKey) === "true");

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    writeStorageString("local", appearanceKey, appearance);
  }, [appearance]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = uokLocaleDirection(locale);
    document.documentElement.dataset.locale = locale;
    writeStorageString("local", localeKey, locale);
  }, [locale]);

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
    locale,
    setAppearance,
    setContactGroupBy,
    setContactsView,
    setLocale,
    setSidebarCollapsed,
    sidebarCollapsed
  };
}

export type WorkbenchPreferences = ReturnType<typeof useWorkbenchPreferences>;

function readPreference<T extends string>(key: string, fallback: T, allowedValues: T[]) {
  const value = readStorageString("local", key, fallback);
  return allowedValues.includes(value as T) ? value as T : fallback;
}
