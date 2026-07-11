import type { SavedSearchView } from "@uok/shared/forms";
import type { ContactGroupBy, ContactQualityFilter, ContactSortBy, ContactSortDir, ContactSourceFilter } from "@uok/shared/types";

export const contactsSavedViewsKey = "uok_contacts_saved_search_views";

export const statusOptions = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" }
];

export const reviewOptions = [
  { value: "all", label: "All reviews" },
  { value: "ready", label: "Ready" },
  { value: "needs_review", label: "Needs review" },
  { value: "possible_duplicate", label: "Possible duplicate" },
  { value: "incomplete", label: "Incomplete" }
];

export const typeOptions = [
  { value: "all", label: "All types" },
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" }
];

export const sourceOptions: Array<{ value: ContactSourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "contacts", label: "Contacts" },
  { value: "gmail", label: "Gmail" },
  { value: "csv_import", label: "CSV import" },
  { value: "email", label: "Email" },
  { value: "manual", label: "Manual" }
];

export const qualityOptions: Array<{ value: ContactQualityFilter; label: string }> = [
  { value: "all", label: "All quality states" },
  { value: "no_company", label: "No company" },
  { value: "duplicate_risk", label: "Duplicate risk" }
];

export const groupOptions = [
  { value: "none", label: "No grouping" },
  { value: "type", label: "Type" },
  { value: "review_state", label: "Review state" },
  { value: "source", label: "Source" },
  { value: "organization", label: "Organization" }
];

export const sortOptions: Array<{ value: ContactSortBy; label: string }> = [
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
  { value: "display_name", label: "Name" },
  { value: "status", label: "Status" },
  { value: "review_state", label: "Review" },
  { value: "party_type", label: "Type" },
  { value: "source", label: "Source" }
];

export const presetSavedViews: SavedSearchView[] = [
  contactPreset("all-records", "All records", { status: "all" }, "none", "updated_at", "desc"),
  contactPreset("needs-review", "Needs review", { review: "needs_review" }, "none", "updated_at", "desc"),
  contactPreset("organizations", "Organizations", { type: "organization" }, "none", "display_name", "asc"),
  contactPreset("people", "People", { type: "person" }, "none", "display_name", "asc"),
  contactPreset("no-company", "No company", { quality: "no_company", type: "person" }, "none", "updated_at", "desc"),
  contactPreset("imported-from-gmail", "Imported from Gmail", { source: "gmail" }, "none", "updated_at", "desc"),
  contactPreset("duplicate-risk", "Duplicate risk", { quality: "duplicate_risk" }, "none", "updated_at", "desc"),
  contactPreset("recently-updated", "Recently updated", {}, "none", "updated_at", "desc")
];

function contactPreset(
  id: string,
  name: string,
  filters: Partial<Record<string, string>>,
  groupBy: ContactGroupBy,
  sortBy: ContactSortBy,
  sortDir: ContactSortDir
): SavedSearchView {
  return {
    id: `contacts-preset-${id}`,
    name,
    query: "",
    filters: {
      "contact-group": "all",
      status: "active",
      review: "all",
      type: "all",
      source: "all",
      quality: "all",
      ...filters
    },
    groupBy,
    sortBy,
    sortDir,
    locked: true
  };
}
