import { ArrowDown, ArrowDownUp, ArrowUp, Bookmark, Check, Filter, Rows3, Save, X } from "lucide-react";
import type { ReactNode } from "react";

import { CommandButton, IconButton } from "../primitives";
import { useUokLocalization } from "../localization";
import type { SavedSearchView, SearchWorkspaceFilter, SearchWorkspaceOption, SearchWorkspaceSort } from "./SearchWorkspace.types";

export function SearchOptionsPanel({
  activeChipCount,
  canSaveView,
  className,
  effectiveGroupBy,
  filters,
  groupOptions,
  groupingEnabled,
  savedViews,
  savedViewsStatus,
  sort,
  supplementalSections,
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
  savedViewsStatus?: ReactNode;
  sort?: SearchWorkspaceSort;
  supplementalSections?: ReactNode;
  viewName: string;
  onApplyView: (view: SavedSearchView) => void;
  onClearAll: () => void;
  onClose: () => void;
  onDeleteView: (viewId: string) => void;
  onGroupByChange: (value: string) => void;
  onSaveCurrentView: () => void;
  onViewNameChange: (value: string) => void;
}) {
  const { t } = useUokLocalization();
  const SortDirectionIcon = sort?.direction === "asc" ? ArrowUp : ArrowDown;
  const nextSortDirection = sort?.direction === "asc" ? "desc" : "asc";
  const sortDirectionLabel = sort?.direction === "asc" ? t("command.sortAscending", "Sort ascending") : t("command.sortDescending", "Sort descending");
  const sortDirectionTitle = sort?.direction === "asc" ? t("command.ascendingTitle", "Ascending. Click for descending.") : t("command.descendingTitle", "Descending. Click for ascending.");

  return (
    <div className={className} role="region" aria-label={t("command.searchOptions", "Search options")}>
      <section className="search-workspace-section" aria-label={t("command.filters", "Filters")}>
        <h3><Filter size={16} aria-hidden="true" /> {t("command.filters", "Filters")}</h3>
        <div className="search-workspace-fields">
          {filters.map((filter) => (
            <label key={filter.id} className="search-workspace-select">
              <span>{filter.label}</span>
              <select aria-label={`${filter.label} ${t("command.filterSuffix", "filter")}`} value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>
      {sort ? (
        <section className="search-workspace-section" aria-label={t("command.sort", "Sort")}>
          <h3><ArrowDownUp size={16} aria-hidden="true" /> {t("command.sort", "Sort")}</h3>
          <div className="search-workspace-fields">
            <label className="search-workspace-select">
              <span>{sort.fieldLabel || t("command.sort", "Sort")}</span>
              <select aria-label={sort.label} value={sort.value} onChange={(event) => sort.onChange(event.target.value)}>
                {sort.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="search-workspace-order">
              <span>{sort.directionLabel || t("command.order", "Order")}</span>
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
        <section className="search-workspace-section" aria-label={t("command.sectionBy", "Section by")}>
          <h3><Rows3 size={16} aria-hidden="true" /> {t("command.sectionBy", "Section by")}</h3>
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
      {supplementalSections}
      <section className="search-workspace-section search-workspace-saved-searches" aria-label={t("command.savedSearches", "Saved searches")}>
        <h3><Bookmark size={16} aria-hidden="true" /> {t("command.savedSearches", "Saved searches")}</h3>
        {savedViewsStatus}
        <label className="search-workspace-save-field">
          <span>{t("command.searchName", "Search name")}</span>
          <input aria-label={t("command.savedSearchName", "Saved search name")} value={viewName} placeholder={t("command.nameThisSearch", "Name this search")} onChange={(event) => onViewNameChange(event.target.value)} />
        </label>
        <CommandButton icon={Save} onClick={onSaveCurrentView} disabled={!canSaveView}>{t("command.saveSearch", "Save search")}</CommandButton>
        <div className="search-workspace-saved-list">
          {savedViews.length ? savedViews.map((view) => (
            <div key={view.id} className="search-workspace-saved-row">
              <button type="button" onClick={() => onApplyView(view)}>{t("command.apply", "Apply")} {view.name}</button>
              {view.locked ? <span aria-hidden="true" /> : (
                <button type="button" aria-label={`${t("command.delete", "Delete")} ${view.name}`} onClick={() => onDeleteView(view.id)}>
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )) : <p>{t("command.noSavedSearches", "No saved searches yet.")}</p>}
        </div>
      </section>
      <div className="search-workspace-actions">
        <CommandButton icon={X} onClick={onClearAll} disabled={!activeChipCount}>{t("command.clearAll", "Clear all")}</CommandButton>
        <CommandButton icon={Check} onClick={onClose}>{t("command.done", "Done")}</CommandButton>
      </div>
    </div>
  );
}
