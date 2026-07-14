import { useState } from "react";
import { cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { emptyDraft } from "@uok/shared/types";
import type { ContactDetailPane, ContactGroupBy, ContactQualityFilter, ContactRecord, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView, UokLocale } from "@uok/shared/types";
import { ContactsWorkspace } from "../../web/src/ContactsWorkspace";
import { contact, contactGroup } from "./ContactsWorkspace.fixtures";
import type { ContactsWorkspaceProps } from "../../web/src/types";

export { businessContactWithoutCompany, contact, contactGroup, duplicateContact, importedContact, organizationContact } from "./ContactsWorkspace.fixtures";

export function resetContactsWorkspaceTest() {
  cleanup();
  localStorage.removeItem("uok_column_widths:contacts.records");
  localStorage.removeItem("uok_column_visibility:contacts.list.display_fields");
  localStorage.removeItem("uok_column_visibility:contacts.list.display_fields.v2");
  localStorage.removeItem("uok_column_visibility:contacts.records");
  localStorage.removeItem("uok_contacts_saved_search_views");
  vi.unstubAllGlobals();
}

export function renderContactsWorkspace(initialView: ContactsView, records: ContactRecord[] = [contact], overrides: Partial<ContactsWorkspaceProps> = {}, locale: UokLocale = "en-US") {
  installDefaultContactsApiMock(records);

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
    const [contactPage, setContactPage] = useState(0);
    const [contactPageSize, setContactPageSize] = useState(25);
    const [contactSortBy, setContactSortBy] = useState<ContactSortBy>("updated_at");
    const [contactSortDir, setContactSortDir] = useState<ContactSortDir>("desc");
    const [noteText, setNoteText] = useState("");
    const [relationshipTarget, setRelationshipTarget] = useState("");
    const [relationshipType, setRelationshipType] = useState("primary_contact");
    const selectedContact = records.find((row) => row.id === selectedId) || null;
    const props: ContactsWorkspaceProps = {
      token: "token",
      currentUserRole: "platform_admin",
      operational: true,
      contacts: records,
      contactGroups: [contactGroup],
      selectedContact,
      selectedContactId: selectedId,
      contactsView,
      contactGroupBy,
      contactGroupId,
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
      relationshipTarget,
      relationshipType,
      busyAction: "",
      onActivate: vi.fn(),
      onRefreshContacts: vi.fn(),
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
      onRelationshipTargetChange: setRelationshipTarget,
      onRelationshipTypeChange: setRelationshipType,
      onLinkRelationship: vi.fn(),
      onUpdateRelationship: vi.fn(),
      onRemoveRelationship: vi.fn(),
      onMergeDuplicate: vi.fn(),
      ...overrides
    };

    return <ContactsWorkspace {...props} />;
  }

  return render(<UokLocalizationProvider locale={locale}><Harness /></UokLocalizationProvider>);
}

function installDefaultContactsApiMock(records: ContactRecord[]) {
  if (typeof globalThis.fetch === "function" && vi.isMockFunction(globalThis.fetch)) return;
  let savedViews: Array<Record<string, unknown>> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const path = String(input);
    const method = options.method || "GET";
    if (path === "/api/contacts/saved-views" && method === "GET") return testResponse(savedViews);
    if (path === "/api/contacts/saved-views" && method === "POST") {
      const payload = JSON.parse(String(options.body));
      const created = { id: `saved-${savedViews.length + 1}`, ...payload, can_edit: true };
      savedViews = [...savedViews, created];
      return testResponse(created);
    }
    if (path.startsWith("/api/contacts/saved-views/") && method === "DELETE") {
      const id = decodeURIComponent(path.split("/").at(-1) || "");
      savedViews = savedViews.filter((view) => view.id !== id);
      return testResponse({ id, deleted: true });
    }
    if (path.includes("/activity?")) return testResponse([], 200, { "X-Total-Count": "0" });
    if (path.startsWith("/api/contacts/relationship-options?")) {
      const params = new URLSearchParams(path.split("?")[1]);
      const query = params.get("query")?.toLocaleLowerCase() || "";
      const excludedId = params.get("exclude_party_id") || "";
      return testResponse(records
        .filter((row) => row.id !== excludedId && row.display_name.toLocaleLowerCase().includes(query))
        .map((row) => ({ id: row.id, display_name: row.display_name, party_type: row.party_type, email: row.email, phone: row.phone })));
    }
    return testResponse({ detail: "Unexpected request" }, 500);
  }));
}

function testResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}
