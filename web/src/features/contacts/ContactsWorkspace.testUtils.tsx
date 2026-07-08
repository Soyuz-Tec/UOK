import { useState } from "react";
import { cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { emptyDraft } from "../../shared/types";
import type { ContactDetailPane, ContactGroupBy, ContactGroupRecord, ContactRecord, ContactSortBy, ContactSortDir, ContactsView } from "../../shared/types";
import { ContactsWorkspace } from "./ContactsWorkspace";
import type { ContactsWorkspaceProps } from "./types";

export const contact: ContactRecord = {
  id: "contact-1",
  party_type: "person",
  display_name: "Example Contact",
  status: "active",
  review_state: "ready",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  attrs: {},
  email: "example@uok.test",
  phone: "+1 555 0100",
  address: "100 Example Street",
  organization_name: "Example Organization"
};

export const importedContact: ContactRecord = {
  id: "contact-2",
  party_type: "person",
  display_name: "imported.person@example.test",
  status: "active",
  review_state: "needs_review",
  visibility_scope: "tenant",
  source: "csv_import",
  sync_state: "ready",
  attrs: {},
  email: "imported.person@example.test"
};

export const businessContactWithoutCompany: ContactRecord = {
  id: "contact-5",
  party_type: "person",
  display_name: "Mina Supplier",
  status: "active",
  review_state: "needs_review",
  visibility_scope: "tenant",
  source: "gmail",
  sync_state: "ready",
  attrs: {},
  email: "mina@supplier.example",
  phone: "+1 555 0160"
};

export const duplicateContact: ContactRecord = {
  id: "contact-3",
  party_type: "person",
  display_name: "Example Contact",
  status: "active",
  review_state: "possible_duplicate",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  attrs: {},
  email: "example@uok.test",
  phone: "+1 555 0111",
  duplicate_candidates: [{ id: "contact-1", display_name: "Example Contact", reason: "email" }]
};

export const organizationContact: ContactRecord = {
  id: "contact-4",
  party_type: "organization",
  display_name: "Avalon Bear Hill",
  status: "active",
  review_state: "ready",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  attrs: {},
  email: "ops@avalon.example"
};

export const contactGroup: ContactGroupRecord = {
  id: "group-1",
  name: "Important contacts",
  description: "",
  kind: "manual",
  visibility_scope: "organization",
  status: "active",
  member_count: 1,
  active_member_count: 1
};

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
      onClearFilters: () => {
        setQuery("");
        setContactGroupId("");
        setStatusFilter("active");
        setReviewFilter("all");
        setTypeFilter("all");
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
