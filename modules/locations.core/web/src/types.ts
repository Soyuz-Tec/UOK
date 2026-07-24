export type LocationStatus = "active" | "archived";
export type LocationType = "port" | "warehouse" | "city" | "region";

export type LocationDefinition = {
  id: string;
  code: string;
  canonical_name: string;
  location_type: LocationType;
  country_code: string;
  status: LocationStatus;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type LocationNameHistory = {
  id: string;
  location_definition_id: string;
  previous_name: string;
  new_name: string;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
};

export type LocationDraft = {
  code: string;
  canonicalName: string;
  locationType: LocationType;
  countryCode: string;
  reason: string;
};

export type LocationSort = "code" | "name";
export type LocationSortDirection = "asc" | "desc";

export const emptyLocationDraft: LocationDraft = {
  code: "",
  canonicalName: "",
  locationType: "port",
  countryCode: "",
  reason: "",
};

export function draftFromLocation(location: LocationDefinition): LocationDraft {
  return {
    code: location.code,
    canonicalName: location.canonical_name,
    locationType: location.location_type,
    countryCode: location.country_code,
    reason: "",
  };
}
