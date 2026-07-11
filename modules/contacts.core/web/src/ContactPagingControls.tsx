import { PaginationControls } from "@uok/shared/tables";
import { useUokLocalization } from "@uok/shared/localization";

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
  const { t } = useUokLocalization();
  return (
    <PaginationControls
      label={t("contacts.paging", "Contact paging")}
      page={page}
      pageSize={pageSize}
      hasNext={hasNext}
      totalCount={totalCount}
      visibleCount={visibleCount}
      pageSizeLabel={t("contacts.pageSize", "Contacts page size")}
      emptyStatusLabel={t("contacts.noRecords", "No contact records")}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
}
