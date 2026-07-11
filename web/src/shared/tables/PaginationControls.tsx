import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { IconButton } from "../primitives";
import { useUokLocalization } from "../localization";

const defaultPageSizeOptions = [25, 50, 100];

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
  previousLabel,
  nextLabel,
  emptyStatusLabel,
  rangeStatusLabel,
}: PaginationControlsProps) {
  const { formatNumber, t } = useUokLocalization();
  const firstRecord = visibleCount ? page * pageSize + 1 : 0;
  const lastRecord = page * pageSize + visibleCount;
  const effectiveTotal = Math.max(totalCount, lastRecord);
  const resolvedRangeStatus = rangeStatusLabel
    ? rangeStatusLabel(firstRecord, lastRecord, effectiveTotal)
    : `${t("pagination.showingRecords", "Showing records")} ${formatNumber(firstRecord)} ${t("pagination.through", "through")} ${formatNumber(lastRecord)} ${t("pagination.of", "of")} ${formatNumber(effectiveTotal)}`;

  return (
    <div className="pagination-controls" aria-label={label}>
      <label className="pagination-page-control">
        <span className="visually-hidden">{t("pagination.rows", "Rows")}</span>
        <span className="pagination-page-size-select">
          <select aria-label={pageSizeLabel || t("pagination.pageSize", "Page size")} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{formatNumber(option)}</option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </label>
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
