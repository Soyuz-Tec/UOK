import { RefreshCw } from "lucide-react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { contactsViewOptions } from "./contactWorkspaceOptions";
import type { ContactGroupBy, ContactGroupRecord, ContactQualityFilter, ContactSortBy, ContactSortDir, ContactSourceFilter, ContactsView } from "./contracts";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkspaceCommandBar } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton, SegmentedControl } from "@uok/shared/primitives";
import { FieldVisibilityMenu, type FieldVisibilityMenuConfig } from "@uok/shared/tables";
import { ContactPagingControls } from "./ContactPagingControls";
import { ContactDataToolsSection } from "./ContactDataToolsSection";
import { ContactGroupsToolsSection } from "./ContactGroupsToolsSection";
import { contactsSavedViewsKey, groupOptions, presetSavedViews, qualityOptions, reviewOptions, sortOptions, sourceOptions, statusOptions, typeOptions } from "./contactsToolbarOptions";
import { useContactSavedViews } from "./useContactSavedViews";

export function ContactsToolbar({
  token,
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
  onCreate,
  onOpenGroupsManager,
  onOpenDataToolsManager,
  currentUserRole,
}: {
  token: string;
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
  onOpenGroupsManager: () => void;
  onOpenDataToolsManager: () => void;
  currentUserRole: string;
}) {
  const { t } = useUokLocalization();
  const contactSavedViews = useContactSavedViews(token);
  const groupingEnabled = contactsView !== "quality";
  const contactGroupFilterOptions = [
    { value: "all", label: "All groups" },
    ...contactGroups.map((group) => ({ value: group.id, label: group.name }))
  ];

  return (
    <WorkspaceCommandBar
      label="Contacts controls"
      className="contacts-toolbar"
      query={(
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
          savedViews={contactSavedViews.savedViews}
          savedViewsStatus={contactSavedViews.loading || contactSavedViews.pendingAction ? (
            <p className="contacts-saved-view-status" role="status">
              {t("contacts.savedViews.working", "Updating saved searches...")}
            </p>
          ) : contactSavedViews.error ? (
            <div className="contacts-saved-view-error" role="alert">
              <p>{t("contacts.savedViews.error", "Saved searches are temporarily unavailable.")} {contactSavedViews.error}</p>
              <CommandButton icon={RefreshCw} onClick={() => void contactSavedViews.reload()}>
                {t("command.refresh", "Refresh")}
              </CommandButton>
            </div>
          ) : null}
          presetViews={presetSavedViews}
          supplementalSections={({ close }) => (
            <>
              <ContactGroupsToolsSection
                onOpen={() => {
                  close();
                  queueMicrotask(onOpenGroupsManager);
                }}
              />
              <ContactDataToolsSection
                canGovern={currentUserRole === "platform_admin" || currentUserRole === "ops_manager"}
                onOpen={() => {
                  close();
                  queueMicrotask(onOpenDataToolsManager);
                }}
              />
            </>
          )}
          onGroupByChange={(value) => onContactGroupByChange(groupingEnabled ? value as ContactGroupBy : "none")}
          onDeleteSavedView={async (viewId) => { await contactSavedViews.remove(viewId); }}
          onSaveSavedView={async (view) => { await contactSavedViews.save(view); }}
          onClear={onClearFilters}
        />
      )}
      pagination={(
        <ContactPagingControls
          page={contactPage}
          pageSize={contactPageSize}
          hasNext={contactHasNext}
          totalCount={contactTotalCount}
          visibleCount={visibleCount}
          onPageChange={onContactPageChange}
          onPageSizeChange={onContactPageSizeChange}
        />
      )}
      view={<SegmentedControl value={contactsView} onChange={onViewChange} options={contactsViewOptions} label="Contacts view" iconOnly />}
      fields={fieldVisibility ? (
        <FieldVisibilityMenu
          groupLabel={fieldVisibility.groupLabel}
          options={fieldVisibility.options}
          visibility={fieldVisibility.visibility}
          onReset={fieldVisibility.onReset}
          onToggle={fieldVisibility.onToggle}
        />
      ) : undefined}
      primaryAction={<WorkspaceActionButton action="create" labelKey="command.newContact" fallbackLabel="New contact" onClick={onCreate} primary />}
    />
  );
}
