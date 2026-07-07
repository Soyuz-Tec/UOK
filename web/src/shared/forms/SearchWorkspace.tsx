import { useEffect, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

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
  onChange: (value: string) => void;
  onGroupByChange: (value: string) => void;
  onClear: () => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [viewName, setViewName] = useState("");
  const groupingEnabled = groupOptions.length > 0;
  const sortingEnabled = Boolean(sort);
  const { savedViews, upsertSavedView, deleteSavedView } = useSavedSearchViews(savedViewsStorageKey);
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

  useEffect(() => {
    const closeFromOutside = (event: MouseEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
      }
    };
    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, []);

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  const clearAll = () => {
    onClear();
    onGroupByChange(groupDefaultValue);
    if (sort) {
      sort.onChange(sort.defaultValue);
      sort.onDirectionChange(sort.defaultDirection);
    }
    closeMenu();
  };

  const saveCurrentView = () => {
    const trimmedName = viewName.trim();
    if (!trimmedName) return;
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
    closeMenu();
  };

  const panelClass = [
    "search-workspace-panel",
    groupingEnabled ? "" : "without-grouping",
    sortingEnabled ? "with-sorting" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="search-workspace" aria-label={label}>
      <SearchField label={label} value={value} onChange={onChange} placeholder={placeholder} />
      <details ref={menuRef} className="search-workspace-menu">
        <summary aria-label={summaryLabel}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>{summary}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <SearchOptionsPanel
          activeChipCount={activeChips.length}
          canSaveView={Boolean(viewName.trim())}
          className={panelClass}
          effectiveGroupBy={effectiveGroupBy}
          filters={filters}
          groupOptions={groupOptions}
          groupingEnabled={groupingEnabled}
          savedViews={savedViews}
          sort={sort}
          viewName={viewName}
          onApplyView={applyView}
          onClearAll={clearAll}
          onClose={closeMenu}
          onDeleteView={deleteSavedView}
          onGroupByChange={(nextGroup) => {
            onGroupByChange(nextGroup);
            closeMenu();
          }}
          onSaveCurrentView={saveCurrentView}
          onViewNameChange={setViewName}
        />
      </details>
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
