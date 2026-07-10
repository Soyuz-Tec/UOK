import type { Section } from "../shared/types";

const sections: Section[] = ["overview", "apps", "contacts", "calendar", "communications", "planning", "evidence", "architecture"];

export function sectionFromSearch(search: string): Section {
  const view = new URLSearchParams(search).get("view") as Section | null;
  return view && sections.includes(view) ? view : "apps";
}
