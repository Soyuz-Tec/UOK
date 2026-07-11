import type { Section } from "../shared/types";
import {
  defaultModuleSection,
  generatedModuleSurfaceCatalog,
} from "../generated/moduleSurfaceCatalog";

const sections = new Set<Section>([
  "overview",
  ...generatedModuleSurfaceCatalog.map(({ manifest }) => manifest.sectionId),
  "evidence",
  "architecture",
]);

export function sectionFromSearch(search: string): Section {
  const view = new URLSearchParams(search).get("view") as Section | null;
  return view && sections.has(view) ? view : defaultModuleSection;
}
