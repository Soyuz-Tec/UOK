import { useState } from "react";
import { cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { emptyDraft } from "../../shared/types";
import type { ContactDetailPane, ContactGroupBy, ContactQualityFilter, ContactRecord, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView } from "../../shared/types";
import { ContactsWorkspace } from "./ContactsWorkspace";
import { contact, contactGroup } from "./ContactsWorkspace.fixtures";
import type { ContactsWorkspaceProps } from "./types";

export { businessContactWithoutCompany, contact, contactGroup, duplicateContact, importedContact, organizationContact } from "./ContactsWorkspace.fixtures";

export function resetContactsWorkspaceTest() {
  cleanup();
  localStorage.removeItem("uok_column_widths:contacts.records");
  localStorage.removeItem("uok_contacts_saved_search_views");
}

export function renderContactsWorkspace(initialView: ContactsView, records: ContactRecord[] = [contact], overrides: Partial<ContactsWorkspaceProps> = {}) {
  function Harness() {
    const [contactsView, setContactsView] = useState<ContactsView>(initialView);
    const [contactGroupBy, setContactGroupBy] = useState<ContactGroupBy>("none");
    const [selectedId, setSelectedId] = useState("");
    const [detailPane, setDetailPane] = useState<ContactDetailPane>("overview");
    const [editing, setEditing] = useState(false);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("active");
    const [reviewFilter, setReviewFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState<ContactSourceFilter>("all");
    const [qualityFilter, setQualityFilter] = useState<ContactQualityFilter>("all");
    const [contactGroupId, setContactGroupId] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [contactPage, setContactPage] = useState(0);
    const [contactPageSize, setContactPageSize] = useState(25);
    const [contactSortBy, setContactSortBy] = useState<ContactSortBy>("updated_at");
    const [contactSortDir, setContactSortDir] = useState<ContactSortDir>("desc");
    const [noteText, setNoteText] = useState("");
    const selectedContact = records.find((row) => row.id === selectedId) || null;
    const props: ContactsWorkspaceProps = {
      token: "token",
      operational: true,
      contacts: records,
      contactGroups: [contactGroup],
      selectedContact,
      selectedContactId: selectedId,
      contactsView,
      contactGroupBy,
      contactGroupId,
      newGroupName,
      detailPane,
      query,
      statusFilter,
      reviewFilter,
      typeFilter,
      sourceFilter,
      qualityFilter,
      contactPage,
      contactPageSize,
      contactHasNext: records.length > contactPageSize,
      contactTotalCount: records.length,
      contactSortBy,
      contactSortDir,
      draft: emptyDraft,
      editing,
      noteText,
      relationshipTarget: "",
      relationshipType: "primary_contact",
      busyAction: "",
      onActivate: vi.fn(),
      onViewChange: setContactsView,
      onContactGroupByChange: setContactGroupBy,
      onContactGroupChange: setContactGroupId,
      onDetailPaneChange: setDetailPane,
      onQueryChange: setQuery,
      onStatusFilterChange: setStatusFilter,
      onReviewFilterChange: setReviewFilter,
      onTypeFilterChange: setTypeFilter,
      onSourceFilterChange: setSourceFilter,
      onQualityFilterChange: setQualityFilter,
      onClearFilters: () => {
        setQuery("");
        setContactGroupId("");
        setStatusFilter("active");
        setReviewFilter("all");
        setTypeFilter("all");
        setSourceFilter("all");
        setQualityFilter("all");
      },
      onContactPageChange: setContactPage,
      onContactPageSizeChange: setContactPageSize,
      onContactSortByChange: setContactSortBy,
      onContactSortDirChange: setContactSortDir,
      onSelect: setSelectedId,
      onCreate: () => {
        setSelectedId("");
        setEditing(true);
      },
      onNewGroupNameChange: setNewGroupName,
      onCreateGroup: vi.fn(),
      onGroupContactsByBusinessDomain: vi.fn(),
      onGroupContactsBySmartRules: vi.fn(),
      onArchiveGroup: vi.fn(),
      onAddSelectedContactToGroup: vi.fn(),
      onRemoveSelectedContactFromGroup: vi.fn(),
      onEdit: () => setEditing(true),
      onInlineUpdate: vi.fn(),
      onDraftChange: vi.fn(),
      onSave: vi.fn(),
      onCancelEdit: () => setEditing(false),
      onArchive: vi.fn(),
      onRestore: vi.fn(),
      onPurge: vi.fn(),
      onMarkReady: vi.fn(),
      onNoteTextChange: setNoteText,
      onAddNote: vi.fn(),
      onRelationshipTargetChange: vi.fn(),
      onRelationshipTypeChange: vi.fn(),
      onLinkRelationship: vi.fn(),
      onUpdateRelationship: vi.fn(),
      onRemoveRelationship: vi.fn(),
      onMergeDuplicate: vi.fn(),
      ...overrides
    };

    return <ContactsWorkspace {...props} />;
  }

  return render(<Harness />);
}
