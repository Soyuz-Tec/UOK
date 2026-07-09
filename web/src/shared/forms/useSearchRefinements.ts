import { useMemo } from "react";

import type { SearchWorkspaceChip, SearchWorkspaceFilter, SearchWorkspaceOption, SearchWorkspaceSort } from "./SearchWorkspace.types";
import { optionLabel } from "./searchWorkspaceUtils";

export function useSearchRefinements({
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
}: {
  value: string;
  filters: SearchWorkspaceFilter[];
  sort?: SearchWorkspaceSort;
  groupBy: string;
  groupOptions: SearchWorkspaceOption[];
  groupDefaultValue: string;
  defaultSummaryLabel: string;
  groupingEnabled: boolean;
  onChange: (value: string) => void;
  onGroupByChange: (value: string) => void;
}) {
  const effectiveGroupBy = groupingEnabled ? groupBy : groupDefaultValue;
  const filterValues = useMemo(
    () => Object.fromEntries(filters.map((filter) => [filter.id, filter.value])),
    [filters]
  );
  const activeChips = useMemo<SearchWorkspaceChip[]>(() => {
    const chips: SearchWorkspaceChip[] = [];
    if (value.trim()) {
      chips.push({ id: "query", label: `Search: ${value.trim()}`, onRemove: () => onChange("") });
    }
    for (const filter of filters) {
      if (filter.value !== filter.defaultValue) {
        chips.push({
          id: `filter-${filter.id}`,
          label: `${filter.label}: ${optionLabel(filter.options, filter.value)}`,
          onRemove: () => filter.onChange(filter.defaultValue)
        });
      }
    }
    if (sort && (sort.value !== sort.defaultValue || sort.direction !== sort.defaultDirection)) {
      chips.push({
        id: "sort",
        label: `Sort: ${optionLabel(sort.options, sort.value)} ${sortDirectionText(sort.direction)}`,
        onRemove: () => {
          sort.onChange(sort.defaultValue);
          sort.onDirectionChange(sort.defaultDirection);
        }
      });
    }
    if (groupingEnabled && effectiveGroupBy !== groupDefaultValue) {
      chips.push({
        id: "group",
        label: `Section: ${optionLabel(groupOptions, effectiveGroupBy)}`,
        onRemove: () => onGroupByChange(groupDefaultValue)
      });
    }
    return chips;
  }, [effectiveGroupBy, filterValues, filters, groupDefaultValue, groupingEnabled, groupOptions, onChange, onGroupByChange, sort, value]);
  const refinementDetails = activeChips.map((chip) => chip.label).join("; ");
  const summary = activeChips.length
    ? activeChips.length === 1
      ? activeChips[0].label
      : `${activeChips.length} refinements`
    : defaultSummaryLabel;
  const summaryLabel = activeChips.length ? `Search options: ${refinementDetails}` : `Search options: ${summary}`;

  return { activeChips, effectiveGroupBy, filterValues, summary, summaryLabel };
}

function sortDirectionText(value: SearchWorkspaceSort["direction"]) {
  return value === "asc" ? "ascending" : "descending";
}
