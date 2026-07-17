import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeSort,
  ComplianceDocumentTypeSortDirection,
  ComplianceDocumentTypeStatusFilter,
} from "./types";

export function filterAndSortComplianceDocumentTypes(
  documentTypes: ComplianceDocumentType[],
  options: {
    query: string;
    status: ComplianceDocumentTypeStatusFilter;
    category: string;
    sortBy: ComplianceDocumentTypeSort;
    sortDirection: ComplianceDocumentTypeSortDirection;
  },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return documentTypes
    .filter((documentType) => statusMatches(documentType, options.status))
    .filter((documentType) => options.category === "all"
      || (documentType.category || "") === options.category)
    .filter((documentType) => !query || [
      documentType.code,
      documentType.canonical_name,
      documentType.description || "",
      documentType.category || "",
    ].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => direction * sortValue(left, options.sortBy)
      .localeCompare(sortValue(right, options.sortBy), undefined, { sensitivity: "base" }));
}

export function complianceDocumentTypeCategories(
  documentTypes: ComplianceDocumentType[],
) {
  return [...new Set(documentTypes
    .map((documentType) => documentType.category?.trim())
    .filter((category): category is string => Boolean(category)))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

function statusMatches(
  documentType: ComplianceDocumentType,
  status: ComplianceDocumentTypeStatusFilter,
) {
  if (status === "all") return true;
  if (status === "current") return documentType.status !== "archived";
  return documentType.status === status;
}

function sortValue(
  documentType: ComplianceDocumentType,
  sortBy: ComplianceDocumentTypeSort,
) {
  if (sortBy === "name") return documentType.canonical_name;
  if (sortBy === "category") return documentType.category || "";
  return documentType.code;
}
