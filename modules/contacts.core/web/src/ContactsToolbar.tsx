import { UserPlus } from "lucide-react";

import { contactsViewOptions } from "@uok/shared/options";
import type { ContactGroupBy, ContactGroupRecord, ContactQualityFilter, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView } from "@uok/shared/types";
import { SearchWorkspace } from "@uok/shared/forms";
import { IconButton, SegmentedControl } from "@uok/shared/primitives";
import { FieldVisibilityMenu, type FieldVisibilityMenuConfig } from "@uok/shared/tables";
import { ContactPagingControls } from "./ContactPagingControls";
import { contactsSavedViewsKey, groupOptions, presetSavedViews, qualityOptions, reviewOptions, sortOptions, sourceOptions, statusOptions, typeOptions } from "./contactsToolbarOptions";

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
  fieldVisibility,
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
  fieldVisibility?: FieldVisibilityMenuConfig;
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
      {fieldVisibility ? (
        <div className="toolbar-group fields-group">
          <FieldVisibilityMenu
            groupLabel={fieldVisibility.groupLabel}
            options={fieldVisibility.options}
            visibility={fieldVisibility.visibility}
            onReset={fieldVisibility.onReset}
            onToggle={fieldVisibility.onToggle}
          />
        </div>
      ) : null}
      <div className="toolbar-group primary-group">
        <IconButton icon={UserPlus} label="New contact" title="New contact" onClick={onCreate} primary />
      </div>
    </div>
  );
}
