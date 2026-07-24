export type PlanningResourceType = "human" | "team" | "vehicle" | "equipment" | "material" | "budget" | "time_window" | "document" | "location" | "asset" | "custom";
export type PlanningCapacityUnit = "fte" | "people" | "units" | "hours_per_day" | "kg" | "tonnes" | "liters" | "currency" | "percent";
export type PlanningResourceCanonicalKind = "party" | "document" | "location" | "asset" | "agreement" | "calendar_event";
export type PlanningResourceCalendar = {
  name: string;
  working_days: number[];
  holidays: string[];
  default_capacity_percent: number;
  capacity_exceptions: Array<{ start: string; end: string; capacity_percent: number; reason: string }>;
};
