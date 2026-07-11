import type { ColumnVisibilityMap, ColumnVisibilityOption } from "@uok/shared/tables";
import type { ContactRecord } from "@uok/shared/types";
import { contactFieldValue, contactVisibilityOptions, type ContactFieldId } from "./contactFieldRegistry";

export const contactListDisplayFieldOptions: ColumnVisibilityOption[] = contactVisibilityOptions([
  "organization",
  "title",
  "email",
  "phone",
  "website",
  "party_type",
  "review_state",
  "source",
  "updated_at"
]).map((option) => ({
  ...option,
  defaultVisible: option.id === "organization" ? option.defaultVisible : false
}));

export function contactListDisplayHeader(visibility: ColumnVisibilityMap) {
  const selected = contactListDisplayFieldOptions.filter((option) => visibility[option.id] !== false);
  if (!selected.length) return "Details";
  if (selected.length === 1) return selected[0].label;
  return selected.map((option) => option.label).join(" + ");
}

export function contactListDisplayValue(contact: ContactRecord, visibility: ColumnVisibilityMap) {
  const values = contactListDisplayFieldOptions
    .filter((option) => visibility[option.id] !== false)
    .map((option) => contactFieldValue(contact, option.id as ContactFieldId))
    .filter(Boolean);
  return values.join(" · ");
}
