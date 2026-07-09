import { useMemo } from "react";

import {
  useColumnVisibility,
  useColumnVisibilityOptions,
  type FieldVisibilityMenuConfig
} from "../../shared/tables";
import type { ContactsView } from "../../shared/types";
import { contactListDisplayFieldOptions } from "./contactListDisplayFields";
import { contactTableColumns, contactTableColumnVisibilityOptions } from "./contactTableColumns";

export function useContactFieldVisibility(
  contactsView: ContactsView,
  onSelectFromTable: (id: string) => void
) {
  const {
    resetColumnVisibility: resetListDisplayFields,
    setColumnVisible: setListDisplayFieldVisible,
    visibility: listDisplayVisibility
  } = useColumnVisibilityOptions("contacts.list.display_fields.v2", contactListDisplayFieldOptions);

  const tableColumns = useMemo(() => contactTableColumns(onSelectFromTable), [onSelectFromTable]);
  const {
    resetColumnVisibility: resetTableFields,
    setColumnVisible: setTableFieldVisible,
    visibility: tableVisibility,
    visibleColumns: tableVisibleColumns
  } = useColumnVisibility(tableColumns, "contacts.records", contactTableColumnVisibilityOptions);

  const fieldVisibility = useMemo<FieldVisibilityMenuConfig | undefined>(() => {
    if (contactsView === "split") {
      return {
        groupLabel: "Visible contact fields",
        options: contactListDisplayFieldOptions,
        visibility: listDisplayVisibility,
        onReset: resetListDisplayFields,
        onToggle: setListDisplayFieldVisible
      };
    }

    if (contactsView === "table") {
      return {
        groupLabel: "Visible contact fields",
        options: contactTableColumnVisibilityOptions,
        visibility: tableVisibility,
        onReset: resetTableFields,
        onToggle: setTableFieldVisible
      };
    }

    return undefined;
  }, [
    contactsView,
    listDisplayVisibility,
    resetListDisplayFields,
    resetTableFields,
    setListDisplayFieldVisible,
    setTableFieldVisible,
    tableVisibility
  ]);

  return { fieldVisibility, listDisplayVisibility, tableVisibleColumns };
}
