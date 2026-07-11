import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { IconButton } from "@uok/shared/primitives";

const pageSizeOptions = [25, 50, 100];

export function ContactPagingControls({
  page,
  pageSize,
  hasNext,
  totalCount,
  visibleCount,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  pageSize: number;
  hasNext: boolean;
  totalCount: number;
  visibleCount: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
}) {
  const firstRecord = visibleCount ? page * pageSize + 1 : 0;
  const lastRecord = page * pageSize + visibleCount;
  const effectiveTotal = Math.max(totalCount, lastRecord);

  return (
    <div className="contact-page-controls" aria-label="Contact paging">
      <label className="contact-page-control">
        <span className="visually-hidden">Rows</span>
        <span className="contact-page-size-select">
          <select aria-label="Contacts page size" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </label>
      <div className="contact-page-stepper" aria-live="polite">
        <IconButton icon={ChevronLeft} label="Previous" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} />
        <span className="contact-page-status" aria-label={visibleCount ? `Showing records ${firstRecord} through ${lastRecord} of ${effectiveTotal}` : "No contact records"}>
          {visibleCount ? `${firstRecord}-${lastRecord} / ${effectiveTotal}` : "0 / 0"}
        </span>
        <IconButton icon={ChevronRight} label="Next" onClick={() => onPageChange(page + 1)} disabled={!hasNext} />
      </div>
    </div>
  );
}
