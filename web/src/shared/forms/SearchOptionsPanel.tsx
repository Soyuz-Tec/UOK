import { ArrowDown, ArrowDownUp, ArrowUp, Bookmark, Check, Filter, Rows3, Save, X } from "lucide-react";

import { CommandButton, IconButton } from "../primitives";
import type { SavedSearchView, SearchWorkspaceFilter, SearchWorkspaceOption, SearchWorkspaceSort } from "./SearchWorkspace.types";
import { optionLabel } from "./searchWorkspaceUtils";

export function SearchOptionsPanel({
  activeChipCount,
  canSaveView,
  className,
  effectiveGroupBy,
  filters,
  groupOptions,
  groupingEnabled,
  savedViews,
  sort,
  viewName,
  onApplyView,
  onClearAll,
  onClose,
  onDeleteView,
  onGroupByChange,
  onSaveCurrentView,
  onViewNameChange
}: {
  activeChipCount: number;
  canSaveView: boolean;
  className: string;
  effectiveGroupBy: string;
  filters: SearchWorkspaceFilter[];
  groupOptions: SearchWorkspaceOption[];
  groupingEnabled: boolean;
  savedViews: SavedSearchView[];
  sort?: SearchWorkspaceSort;
  viewName: string;
  onApplyView: (view: SavedSearchView) => void;
  onClearAll: () => void;
  onClose: () => void;
  onDeleteView: (viewId: string) => void;
  onGroupByChange: (value: string) => void;
  onSaveCurrentView: () => void;
  onViewNameChange: (value: string) => void;
}) {
  const SortDirectionIcon = sort?.direction === "asc" ? ArrowUp : ArrowDown;
  const nextSortDirection = sort?.direction === "asc" ? "desc" : "asc";
  const sortDirectionLabel = sort?.direction === "asc" ? "Sort ascending" : "Sort descending";
  const sortDirectionTitle = sort?.direction === "asc" ? "Ascending. Click for descending." : "Descending. Click for ascending.";

  return (
    <div className={className} role="region" aria-label="Search options">
      <section className="search-workspace-section" aria-label="Filters">
        <h3><Filter size={16} aria-hidden="true" /> Filters</h3>
        <div className="search-workspace-fields">
          {filters.map((filter) => (
            <label key={filter.id} className="search-workspace-select">
              <span>{filter.label}</span>
              <select aria-label={`${filter.label} filter`} value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>
      {sort ? (
        <section className="search-workspace-section" aria-label="Sort">
          <h3><ArrowDownUp size={16} aria-hidden="true" /> Sort</h3>
          <div className="search-workspace-fields">
            <label className="search-workspace-select">
              <span>{sort.fieldLabel || "Sort"}</span>
              <select aria-label={sort.label} value={sort.value} onChange={(event) => sort.onChange(event.target.value)}>
                {sort.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="search-workspace-order">
              <span>{sort.directionLabel || "Order"}</span>
              <IconButton
                icon={SortDirectionIcon}
                label={sortDirectionLabel}
                title={sortDirectionTitle}
                onClick={() => sort.onDirectionChange(nextSortDirection)}
              />
            </div>
          </div>
        </section>
      ) : null}
      {groupingEnabled ? (
        <section className="search-workspace-section" aria-label="Section by">
          <h3><Rows3 size={16} aria-hidden="true" /> Section by</h3>
          <div className="search-workspace-option-grid">
            {groupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={effectiveGroupBy === option.value ? "search-workspace-option selected" : "search-workspace-option"}
                aria-pressed={effectiveGroupBy === option.value}
                onClick={() => onGroupByChange(option.value)}
              >
                {effectiveGroupBy === option.value ? <Check size={15} aria-hidden="true" /> : <span aria-hidden="true" />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="search-workspace-section" aria-label="Saved searches">
        <h3><Bookmark size={16} aria-hidden="true" /> Saved searches</h3>
        <label className="search-workspace-save-field">
          <span>Search name</span>
          <input aria-label="Saved search name" value={viewName} placeholder="Name this search" onChange={(event) => onViewNameChange(event.target.value)} />
        </label>
        <CommandButton icon={Save} onClick={onSaveCurrentView} disabled={!canSaveView}>Save search</CommandButton>
        <div className="search-workspace-saved-list">
          {savedViews.length ? savedViews.map((view) => (
            <div key={view.id} className="search-workspace-saved-row">
              <button type="button" onClick={() => onApplyView(view)}>Apply {view.name}</button>
              <button type="button" aria-label={`Delete ${view.name}`} onClick={() => onDeleteView(view.id)}>
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          )) : <p>No saved searches yet.</p>}
        </div>
      </section>
      <div className="search-workspace-actions">
        <CommandButton icon={X} onClick={onClearAll} disabled={!activeChipCount}>Clear all</CommandButton>
        <CommandButton icon={Check} onClick={onClose}>Done</CommandButton>
      </div>
    </div>
  );
}
