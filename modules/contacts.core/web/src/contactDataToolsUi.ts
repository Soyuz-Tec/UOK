import type { ContactGroupRecord, ContactRecord } from "./contracts";
import type { ContactDataToolsApi } from "./contactDataToolsApi";

export type ContactDataToolsRun = <T,>(
  action: string,
  operation: () => Promise<T>,
  successMessage?: string,
  options?: { rethrow?: boolean },
) => Promise<T | undefined>;

export type ContactDataToolsPanelProps = {
  api: ContactDataToolsApi;
  canGovern: boolean;
  canRestore: boolean;
  contacts: ContactRecord[];
  groups: ContactGroupRecord[];
  selectedContact: ContactRecord | null;
  selectedIds: string[];
  busyAction: string;
  run: ContactDataToolsRun;
  onChanged: () => Promise<void> | void;
  onSelectedIdsChange: (ids: string[]) => void;
};

export function toggleSelectedId(selectedIds: string[], id: string) {
  return selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id];
}
