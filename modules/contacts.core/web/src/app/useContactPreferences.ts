import { useEffect, useState } from "react";

import { readStorageString, writeStorageString } from "@uok/shared/storage";
import type { ContactGroupBy, ContactsView } from "../contracts";

const contactsViewKey = "uok_contacts_view";
const contactsGroupByKey = "uok_contacts_group_by";

export function useContactPreferences() {
  const [contactsView, setContactsView] = useState<ContactsView>(() =>
    readPreference(contactsViewKey, "split", ["cards", "quality", "split", "table"])
  );
  const [contactGroupBy, setContactGroupBy] = useState<ContactGroupBy>(() =>
    readPreference(
      contactsGroupByKey,
      "none",
      ["none", "organization", "review_state", "source", "type"],
    )
  );

  useEffect(() => {
    writeStorageString("local", contactsViewKey, contactsView);
  }, [contactsView]);

  useEffect(() => {
    writeStorageString("local", contactsGroupByKey, contactGroupBy);
  }, [contactGroupBy]);

  return {
    contactGroupBy,
    contactsView,
    setContactGroupBy,
    setContactsView,
  };
}

export type ContactPreferences = ReturnType<typeof useContactPreferences>;

function readPreference<T extends string>(key: string, fallback: T, allowedValues: T[]) {
  const value = readStorageString("local", key, fallback);
  return allowedValues.includes(value as T) ? value as T : fallback;
}
