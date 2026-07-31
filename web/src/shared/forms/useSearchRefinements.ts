import { useMemo } from "react";

import { useUokLocalization } from "../localization";
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
  const { formatNumber, t } = useUokLocalization();
  const effectiveGroupBy = groupingEnabled ? groupBy : groupDefaultValue;
  const filterValues = useMemo(
    () => Object.fromEntries(filters.map((filter) => [filter.id, filter.value])),
    [filters]
  );
  const activeChips = useMemo<SearchWorkspaceChip[]>(() => {
    const chips: SearchWorkspaceChip[] = [];
    if (value.trim()) {
      chips.push({ id: "query", label: `${t("command.refinementSearch", "Search")}: ${value.trim()}`, onRemove: () => onChange("") });
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
        label: `${t("command.refinementSort", "Sort")}: ${optionLabel(sort.options, sort.value)} ${sortDirectionText(sort.direction, t)}`,
        onRemove: () => {
          sort.onChange(sort.defaultValue);
          sort.onDirectionChange(sort.defaultDirection);
        }
      });
    }
    if (groupingEnabled && effectiveGroupBy !== groupDefaultValue) {
      chips.push({
        id: "group",
        label: `${t("command.refinementSection", "Section")}: ${optionLabel(groupOptions, effectiveGroupBy)}`,
        onRemove: () => onGroupByChange(groupDefaultValue)
      });
    }
    return chips;
  }, [effectiveGroupBy, filters, groupDefaultValue, groupingEnabled, groupOptions, onChange, onGroupByChange, sort, t, value]);
  const refinementDetails = activeChips.map((chip) => chip.label).join("; ");
  const summary = activeChips.length
    ? activeChips.length === 1
      ? activeChips[0].label
      : `${formatNumber(activeChips.length)} ${t("command.refinements", "refinements")}`
    : defaultSummaryLabel;
  const searchOptionsLabel = t("command.searchOptions", "Search options");
  const summaryLabel = activeChips.length ? `${searchOptionsLabel}: ${refinementDetails}` : `${searchOptionsLabel}: ${summary}`;

  return { activeChips, effectiveGroupBy, filterValues, summary, summaryLabel };
}

function sortDirectionText(value: SearchWorkspaceSort["direction"], t: (key: string, fallback?: string) => string) {
  return value === "asc" ? t("command.ascending", "ascending") : t("command.descending", "descending");
}
