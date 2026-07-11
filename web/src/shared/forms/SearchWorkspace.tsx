import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { useUokLocalization } from "../localization";
import { ExpandableControlPanel } from "./ExpandableControlPanel";
import { SearchField } from "./SearchField";
import { SearchOptionsPanel } from "./SearchOptionsPanel";
import { SearchRefinementChips } from "./SearchRefinementChips";
import type { SavedSearchView, SearchWorkspaceFilter, SearchWorkspaceOption, SearchWorkspaceSort, SearchWorkspaceSortDirection } from "./SearchWorkspace.types";
import { useSavedSearchViews } from "./useSavedSearchViews";
import { useSearchRefinements } from "./useSearchRefinements";

export function SearchWorkspace({
  label,
  value,
  placeholder,
  filters,
  sort,
  groupBy,
  groupOptions,
  groupDefaultValue = "none",
  defaultSummaryLabel = "All records",
  savedViewsStorageKey,
  presetViews = [],
  onChange,
  onGroupByChange,
  onClear
}: {
  label: string;
  value: string;
  placeholder: string;
  filters: SearchWorkspaceFilter[];
  sort?: SearchWorkspaceSort;
  groupBy: string;
  groupOptions: SearchWorkspaceOption[];
  groupDefaultValue?: string;
  defaultSummaryLabel?: string;
  savedViewsStorageKey: string;
  presetViews?: SavedSearchView[];
  onChange: (value: string) => void;
  onGroupByChange: (value: string) => void;
  onClear: () => void;
}) {
  const { t } = useUokLocalization();
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const groupingEnabled = groupOptions.length > 0;
  const sortingEnabled = Boolean(sort);
  const { savedViews, upsertSavedView, deleteSavedView } = useSavedSearchViews(savedViewsStorageKey);
  const presetNames = new Set(presetViews.map((view) => view.name.trim().toLocaleLowerCase()));
  const availableSavedViews = [...presetViews, ...savedViews.filter((view) => !presetNames.has(view.name.trim().toLocaleLowerCase()))];
  const canSaveView = Boolean(viewName.trim()) && !presetNames.has(viewName.trim().toLocaleLowerCase());
  const { activeChips, effectiveGroupBy, filterValues, summary, summaryLabel } = useSearchRefinements({
    value,
    filters,
    sort,
    groupBy,
    groupOptions,
    groupDefaultValue,
    defaultSummaryLabel,
    groupingEnabled,
    onChange,
    onGroupByChange
  });

  const clearAll = () => {
    onClear();
    onGroupByChange(groupDefaultValue);
    if (sort) {
      sort.onChange(sort.defaultValue);
      sort.onDirectionChange(sort.defaultDirection);
    }
  };

  const saveCurrentView = () => {
    const trimmedName = viewName.trim();
    if (!trimmedName || presetNames.has(trimmedName.toLocaleLowerCase())) return;
    upsertSavedView({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      query: value,
      filters: filterValues,
      groupBy: effectiveGroupBy,
      sortBy: sort?.value,
      sortDir: sort?.direction
    });
    setViewName("");
  };

  const applyView = (view: SavedSearchView) => {
    onChange(view.query);
    const savedFilters = view.filters && typeof view.filters === "object" ? view.filters : {};
    for (const filter of filters) {
      filter.onChange(validOptionValue(filter.options, savedFilters[filter.id], filter.defaultValue));
    }
    if (groupingEnabled) onGroupByChange(validOptionValue(groupOptions, view.groupBy, groupDefaultValue));
    if (sort) {
      sort.onChange(validOptionValue(sort.options, view.sortBy, sort.defaultValue));
      sort.onDirectionChange(validSortDirection(view.sortDir, sort.defaultDirection));
    }
  };

  const panelClass = [
    "search-workspace-panel",
    groupingEnabled ? "" : "without-grouping",
    sortingEnabled ? "with-sorting" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="search-workspace" aria-label={label}>
      <SearchField label={label} value={value} onChange={onChange} placeholder={placeholder} />
      <ExpandableControlPanel
        className="search-workspace-menu"
        label={t("command.searchOptions", "Search options")}
        open={menuOpen}
        panelClassName={panelClass}
        triggerIcon={SlidersHorizontal}
        triggerLabel={summaryLabel}
        triggerSummary={summary}
        onOpenChange={setMenuOpen}
      >
        {({ close }) => <SearchOptionsPanel
          activeChipCount={activeChips.length}
          canSaveView={canSaveView}
          className="search-workspace-panel-content"
          effectiveGroupBy={effectiveGroupBy}
          filters={filters}
          groupOptions={groupOptions}
          groupingEnabled={groupingEnabled}
          savedViews={availableSavedViews}
          sort={sort}
          viewName={viewName}
          onApplyView={(view) => {
            applyView(view);
            close();
          }}
          onClearAll={clearAll}
          onClose={close}
          onDeleteView={deleteSavedView}
          onGroupByChange={onGroupByChange}
          onSaveCurrentView={saveCurrentView}
          onViewNameChange={setViewName}
        />}
      </ExpandableControlPanel>
      <SearchRefinementChips chips={activeChips} />
    </div>
  );
}

function validOptionValue(options: SearchWorkspaceOption[], value: string | undefined, fallback: string) {
  return value && options.some((option) => option.value === value) ? value : fallback;
}

function validSortDirection(value: SearchWorkspaceSortDirection | undefined, fallback: SearchWorkspaceSortDirection) {
  return value === "asc" || value === "desc" ? value : fallback;
}
