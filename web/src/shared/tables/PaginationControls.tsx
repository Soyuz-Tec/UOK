import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ExpandableControlPanel } from "../forms";
import { IconButton } from "../primitives";
import { useUokLocalization } from "../localization";

const defaultPageSizeOptions = [10, 25, 50];
const defaultMaxPageSize = 100;

export type PaginationControlsProps = {
  label: string;
  page: number;
  pageSize: number;
  hasNext: boolean;
  totalCount: number;
  visibleCount: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  pageSizeLabel?: string;
  pageSizeOptions?: number[];
  maxPageSize?: number;
  previousLabel?: string;
  nextLabel?: string;
  emptyStatusLabel?: string;
  rangeStatusLabel?: (firstRecord: number, lastRecord: number, totalCount: number) => string;
};

export function PaginationControls({
  label,
  page,
  pageSize,
  hasNext,
  totalCount,
  visibleCount,
  onPageChange,
  onPageSizeChange,
  pageSizeLabel,
  pageSizeOptions = defaultPageSizeOptions,
  maxPageSize = defaultMaxPageSize,
  previousLabel,
  nextLabel,
  emptyStatusLabel,
  rangeStatusLabel,
}: PaginationControlsProps) {
  const { formatNumber, t } = useUokLocalization();
  const customPageSizeId = useId();
  const [isPageSizeMenuOpen, setIsPageSizeMenuOpen] = useState(false);
  const [pageSizeDraft, setPageSizeDraft] = useState(String(pageSize));
  const firstRecord = visibleCount ? page * pageSize + 1 : 0;
  const lastRecord = page * pageSize + visibleCount;
  const effectiveTotal = Math.max(totalCount, lastRecord);
  const resolvedRangeStatus = rangeStatusLabel
    ? rangeStatusLabel(firstRecord, lastRecord, effectiveTotal)
    : `${t("pagination.showingRecords", "Showing records")} ${formatNumber(firstRecord)} ${t("pagination.through", "through")} ${formatNumber(lastRecord)} ${t("pagination.of", "of")} ${formatNumber(effectiveTotal)}`;
  const pageSizeInputLabel = pageSizeLabel || t("pagination.pageSize", "Page size");
  const resolvedPageSizeOptions = useMemo(() => {
    const seen = new Set<number>();
    return pageSizeOptions.reduce<number[]>((options, option) => {
      const parsed = Math.trunc(Number(option));
      if (!Number.isFinite(parsed) || parsed < 1) return options;
      const nextOption = Math.min(parsed, maxPageSize);
      if (seen.has(nextOption)) return options;
      seen.add(nextOption);
      return [...options, nextOption];
    }, []);
  }, [maxPageSize, pageSizeOptions]);

  useEffect(() => {
    setPageSizeDraft(String(pageSize));
  }, [pageSize]);

  function resolvedPageSize(value: string) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return Math.min(parsed, maxPageSize);
  }

  function selectPageSize(value: number) {
    const nextPageSize = resolvedPageSize(String(value));
    if (nextPageSize === null) return;
    setPageSizeDraft(String(nextPageSize));
    setIsPageSizeMenuOpen(false);
    if (nextPageSize !== pageSize) onPageSizeChange(nextPageSize);
  }

  function applyCustomPageSize(value: string) {
    const nextPageSize = resolvedPageSize(value);
    if (nextPageSize === null) return;
    setPageSizeDraft(String(nextPageSize));
    setIsPageSizeMenuOpen(false);
    if (nextPageSize !== pageSize) onPageSizeChange(nextPageSize);
  }

  function handlePageSizeMenuChange(open: boolean) {
    setIsPageSizeMenuOpen(open);
    setPageSizeDraft(String(pageSize));
  }

  return (
    <div className="pagination-controls" aria-label={label}>
      <div className="pagination-page-control">
        <span className="visually-hidden">{t("pagination.rows", "Rows")}</span>
        <ExpandableControlPanel
          className="pagination-page-size-select"
          label={pageSizeInputLabel}
          panelClassName="pagination-page-size-panel"
          triggerLabel={pageSizeInputLabel}
          triggerSummary={formatNumber(pageSize)}
          open={isPageSizeMenuOpen}
          onOpenChange={handlePageSizeMenuChange}
        >
          {({ close }) => (
            <>
              <div className="pagination-page-size-options" aria-label={t("pagination.quickPageSizes", "Quick page sizes")}>
                {resolvedPageSizeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="pagination-page-size-option"
                    aria-pressed={option === pageSize}
                    onClick={() => {
                      selectPageSize(option);
                      close();
                    }}
                  >
                    {formatNumber(option)}
                  </button>
                ))}
              </div>
              <div className="pagination-page-size-custom">
                <label htmlFor={customPageSizeId}>{t("pagination.customPageSize", "Custom")}</label>
                <div className="pagination-page-size-custom-row">
                  <input
                    id={customPageSizeId}
                    data-page-size-custom="true"
                    aria-describedby={`${customPageSizeId}-hint`}
                    value={pageSizeDraft}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxPageSize}
                    step={1}
                    onChange={(event) => setPageSizeDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyCustomPageSize(event.currentTarget.value);
                        close();
                      }
                    }}
                  />
                  <button type="button" onClick={() => {
                    applyCustomPageSize(pageSizeDraft);
                    close();
                  }}>
                    {t("command.apply", "Apply")}
                  </button>
                </div>
                <span id={`${customPageSizeId}-hint`} className="pagination-page-size-hint">
                  {t("pagination.pageSizeMax", "Maximum")} {formatNumber(maxPageSize)}
                </span>
              </div>
            </>
          )}
        </ExpandableControlPanel>
      </div>
      <div className="pagination-stepper" aria-live="polite">
        <IconButton icon={ChevronLeft} label={previousLabel || t("pagination.previous", "Previous")} onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} />
        <span
          className="pagination-status"
          aria-label={visibleCount ? resolvedRangeStatus : emptyStatusLabel || t("pagination.noRecords", "No records")}
        >
          {visibleCount ? `${formatNumber(firstRecord)}-${formatNumber(lastRecord)} / ${formatNumber(effectiveTotal)}` : `${formatNumber(0)} / ${formatNumber(0)}`}
        </span>
        <IconButton icon={ChevronRight} label={nextLabel || t("pagination.next", "Next")} onClick={() => onPageChange(page + 1)} disabled={!hasNext} />
      </div>
    </div>
  );
}
