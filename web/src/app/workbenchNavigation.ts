import type { Section } from "../shared/types";
import {
  defaultModuleSection,
  generatedModuleSections,
} from "../generated/moduleSections";

const sections = new Set<Section>([
  "overview",
  ...generatedModuleSections,
  "evidence",
  "architecture",
]);

export function sectionFromSearch(search: string): Section {
  const view = new URLSearchParams(search).get("view") as Section | null;
  return view && sections.has(view) ? view : defaultModuleSection;
}
