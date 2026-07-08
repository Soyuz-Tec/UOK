import { UserPlus } from "lucide-react";

import { contactsViewOptions } from "../../shared/options";
import type { ContactGroupBy, ContactGroupRecord, ContactQualityFilter, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView } from "../../shared/types";
import { SearchWorkspace } from "../../shared/forms";
import type { SavedSearchView } from "../../shared/forms";
import { IconButton, SegmentedControl } from "../../shared/primitives";
import { ContactPagingControls } from "./ContactPagingControls";

const contactsSavedViewsKey = "uok_contacts_saved_search_views";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" }
];

const reviewOptions = [
  { value: "all", label: "All reviews" },
  { value: "ready", label: "Ready" },
  { value: "needs_review", label: "Needs review" },
  { value: "possible_duplicate", label: "Possible duplicate" },
  { value: "incomplete", label: "Incomplete" }
];

const typeOptions = [
  { value: "all", label: "All types" },
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" }
];

const sourceOptions: Array<{ value: ContactSourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "contacts", label: "Contacts" },
  { value: "gmail", label: "Gmail" },
  { value: "csv_import", label: "CSV import" },
  { value: "email", label: "Email" },
  { value: "manual", label: "Manual" }
];

const qualityOptions: Array<{ value: ContactQualityFilter; label: string }> = [
  { value: "all", label: "All quality states" },
  { value: "no_company", label: "No company" },
  { value: "duplicate_risk", label: "Duplicate risk" }
];

const groupOptions = [
  { value: "none", label: "No grouping" },
  { value: "type", label: "Type" },
  { value: "review_state", label: "Review state" },
  { value: "source", label: "Source" },
  { value: "organization", label: "Organization" }
];

const sortOptions: Array<{ value: ContactSortBy; label: string }> = [
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
  { value: "display_name", label: "Name" },
  { value: "status", label: "Status" },
  { value: "review_state", label: "Review" },
  { value: "party_type", label: "Type" },
  { value: "source", label: "Source" }
];

const presetSavedViews: SavedSearchView[] = [
  contactPreset("all-records", "All records", { status: "all" }, "none", "updated_at", "desc"),
  contactPreset("needs-review", "Needs review", { review: "needs_review" }, "none", "updated_at", "desc"),
  contactPreset("organizations", "Organizations", { type: "organization" }, "none", "display_name", "asc"),
  contactPreset("people", "People", { type: "person" }, "none", "display_name", "asc"),
  contactPreset("no-company", "No company", { quality: "no_company", type: "person" }, "none", "updated_at", "desc"),
  contactPreset("imported-from-gmail", "Imported from Gmail", { source: "gmail" }, "none", "updated_at", "desc"),
  contactPreset("duplicate-risk", "Duplicate risk", { quality: "duplicate_risk" }, "none", "updated_at", "desc"),
  contactPreset("recently-updated", "Recently updated", {}, "none", "updated_at", "desc")
];

export function ContactsToolbar({
  query,
  statusFilter,
  reviewFilter,
  typeFilter,
  sourceFilter,
  qualityFilter,
  contactGroups,
  contactGroupId,
  contactPage,
  contactPageSize,
  contactHasNext,
  contactTotalCount,
  visibleCount,
  contactSortBy,
  contactSortDir,
  contactsView,
  contactGroupBy,
  onQueryChange,
  onStatusFilterChange,
  onReviewFilterChange,
  onTypeFilterChange,
  onSourceFilterChange,
  onQualityFilterChange,
  onContactGroupChange,
  onContactGroupByChange,
  onClearFilters,
  onContactPageChange,
  onContactPageSizeChange,
  onContactSortByChange,
  onContactSortDirChange,
  onViewChange,
  onCreate
}: {
  query: string;
  statusFilter: string;
  reviewFilter: string;
  typeFilter: string;
  sourceFilter: ContactSourceFilter;
  qualityFilter: ContactQualityFilter;
  contactGroups: ContactGroupRecord[];
  contactGroupId: string;
  contactPage: number;
  contactPageSize: number;
  contactHasNext: boolean;
  contactTotalCount: number;
  visibleCount: number;
  contactSortBy: ContactSortBy;
  contactSortDir: ContactSortDir;
  contactsView: ContactsView;
  contactGroupBy: ContactGroupBy;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onReviewFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onSourceFilterChange: (value: ContactSourceFilter) => void;
  onQualityFilterChange: (value: ContactQualityFilter) => void;
  onContactGroupChange: (value: string) => void;
  onContactGroupByChange: (value: ContactGroupBy) => void;
  onClearFilters: () => void;
  onContactPageChange: (value: number) => void;
  onContactPageSizeChange: (value: number) => void;
  onContactSortByChange: (value: ContactSortBy) => void;
  onContactSortDirChange: (value: ContactSortDir) => void;
  onViewChange: (value: ContactsView) => void;
  onCreate: () => void;
}) {
  const groupingEnabled = contactsView !== "quality";
  const contactGroupFilterOptions = [
    { value: "all", label: "All groups" },
    ...contactGroups.map((group) => ({ value: group.id, label: group.name }))
  ];

  return (
    <div className="contacts-toolbar" aria-label="Contacts controls">
      <div className="toolbar-group search-group">
        <SearchWorkspace
          label="Search contacts"
          value={query}
          onChange={onQueryChange}
          placeholder="Search contacts"
          defaultSummaryLabel="Active records"
          filters={[
            { id: "contact-group", label: "Group", value: contactGroupId || "all", defaultValue: "all", options: contactGroupFilterOptions, onChange: (value) => onContactGroupChange(value === "all" ? "" : value) },
            { id: "status", label: "Status", value: statusFilter, defaultValue: "active", options: statusOptions, onChange: onStatusFilterChange },
            { id: "review", label: "Review", value: reviewFilter, defaultValue: "all", options: reviewOptions, onChange: onReviewFilterChange },
            { id: "type", label: "Type", value: typeFilter, defaultValue: "all", options: typeOptions, onChange: onTypeFilterChange },
            { id: "source", label: "Source", value: sourceFilter, defaultValue: "all", options: sourceOptions, onChange: (value) => onSourceFilterChange(value as ContactSourceFilter) },
            { id: "quality", label: "Quality", value: qualityFilter, defaultValue: "all", options: qualityOptions, onChange: (value) => onQualityFilterChange(value as ContactQualityFilter) }
          ]}
          sort={{
            label: "Contact sort field",
            fieldLabel: "Sort",
            directionLabel: "Order",
            value: contactSortBy,
            defaultValue: "updated_at",
            options: sortOptions,
            direction: contactSortDir,
            defaultDirection: "desc",
            onChange: (value) => onContactSortByChange(value as ContactSortBy),
            onDirectionChange: (value) => onContactSortDirChange(value as ContactSortDir)
          }}
          groupBy={groupingEnabled ? contactGroupBy : "none"}
          groupOptions={groupingEnabled ? groupOptions : []}
          savedViewsStorageKey={contactsSavedViewsKey}
          presetViews={presetSavedViews}
          onGroupByChange={(value) => onContactGroupByChange(groupingEnabled ? value as ContactGroupBy : "none")}
          onClear={onClearFilters}
        />
      </div>
      <div className="toolbar-group page-group">
        <ContactPagingControls
          page={contactPage}
          pageSize={contactPageSize}
          hasNext={contactHasNext}
          totalCount={contactTotalCount}
          visibleCount={visibleCount}
          onPageChange={onContactPageChange}
          onPageSizeChange={onContactPageSizeChange}
        />
      </div>
      <div className="toolbar-group view-group">
        <SegmentedControl value={contactsView} onChange={onViewChange} options={contactsViewOptions} label="Contacts view" iconOnly />
      </div>
      <div className="toolbar-group primary-group">
        <IconButton icon={UserPlus} label="New contact" title="New contact" onClick={onCreate} primary />
      </div>
    </div>
  );
}

function contactPreset(
  id: string,
  name: string,
  filters: Partial<Record<string, string>>,
  groupBy: ContactGroupBy,
  sortBy: ContactSortBy,
  sortDir: ContactSortDir
): SavedSearchView {
  return {
    id: `contacts-preset-${id}`,
    name,
    query: "",
    filters: {
      "contact-group": "all",
      status: "active",
      review: "all",
      type: "all",
      source: "all",
      quality: "all",
      ...filters
    },
    groupBy,
    sortBy,
    sortDir,
    locked: true
  };
}
