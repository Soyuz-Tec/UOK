import type { HostModuleStatus } from "@uok/contracts/moduleSurface";
import type { ContactReadBoundary } from "./app/contactReadAuthority";
import type { ContactDetailPane, ContactDraft, ContactGroupBy, ContactGroupRecord, ContactMergeFieldChoices, ContactQualityFilter, ContactRecord, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView } from "./contracts";

export type ContactsWorkspaceProps = {
  token: string;
  contactReadBoundary: ContactReadBoundary;
  onUnauthorized: () => void;
  currentUserRole: string;
  canManage: boolean;
  operational: boolean;
  module?: HostModuleStatus;
  contacts: ContactRecord[];
  contactGroups: ContactGroupRecord[];
  selectedContact: ContactRecord | null;
  selectedContactId: string;
  contactsView: ContactsView;
  contactGroupBy: ContactGroupBy;
  contactGroupId: string;
  detailPane: ContactDetailPane;
  query: string;
  statusFilter: string;
  reviewFilter: string;
  typeFilter: string;
  sourceFilter: ContactSourceFilter;
  qualityFilter: ContactQualityFilter;
  contactPage: number;
  contactPageSize: number;
  contactHasNext: boolean;
  contactTotalCount: number;
  contactSortBy: ContactSortBy;
  contactSortDir: ContactSortDir;
  draft: ContactDraft;
  editing: boolean;
  noteText: string;
  relationshipTarget: string;
  relationshipType: string;
  activityRefreshGeneration: number;
  busyAction: string;
  onActivate: () => void;
  onRefreshContacts: () => Promise<void> | void;
  onViewChange: (value: ContactsView) => void;
  onContactGroupByChange: (value: ContactGroupBy) => void;
  onContactGroupChange: (value: string) => void;
  onDetailPaneChange: (value: ContactDetailPane) => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onReviewFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onSourceFilterChange: (value: ContactSourceFilter) => void;
  onQualityFilterChange: (value: ContactQualityFilter) => void;
  onClearFilters: () => void;
  onContactPageChange: (value: number) => void;
  onContactPageSizeChange: (value: number) => void;
  onContactSortByChange: (value: ContactSortBy) => void;
  onContactSortDirChange: (value: ContactSortDir) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAddSelectedContactToGroup: (groupId: string) => Promise<boolean>;
  onRemoveSelectedContactFromGroup: (groupId: string) => Promise<boolean>;
  onEdit: () => void;
  onInlineUpdate: (field: keyof ContactDraft, value: string) => Promise<void>;
  onDraftChange: (draft: ContactDraft) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onArchive: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onPurge: () => void | Promise<void>;
  onMarkReady: () => void;
  onNoteTextChange: (value: string) => void;
  onAddNote: () => void;
  onRelationshipTargetChange: (value: string) => void;
  onRelationshipTypeChange: (value: string) => void;
  onLinkRelationship: () => void;
  onUpdateRelationship: (
    relationshipId: string,
    fromPartyId: string,
    toPartyId: string,
    relationshipType: string,
    editorIntent: ContactRelationshipEditorIntent,
  ) => Promise<boolean>;
  onRemoveRelationship: (relationshipId: string) => Promise<boolean>;
  onMergeDuplicate: (primaryContactId: string, duplicateContactId: string, fieldChoices?: ContactMergeFieldChoices) => Promise<boolean>;
};

export type ContactRelationshipEditorIntent = Readonly<{
  generation: number;
  isCurrent: (generation: number) => boolean;
}>;

export type ContactRelationship = NonNullable<ContactRecord["relationships"]>[number];
