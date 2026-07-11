import type { ReactNode } from "react";

import type { Workbench } from "@uok/app/useWorkbench";
import { generatedModuleSurfaceCatalog } from "@uok/generated/moduleSurfaceCatalog";
import type { Option } from "@uok/shared/options";
import type { Section } from "@uok/shared/types";

import type {
  GeneratedModuleSurfaceRegistration,
  ModuleSurface,
} from "./moduleSurfaceContract";

type ValidatedModuleSurface = Omit<ModuleSurface, "id"> & { id: Section };

export function validateModuleSurfaceCatalog(
  registrations: readonly GeneratedModuleSurfaceRegistration[],
): ValidatedModuleSurface[] {
  const moduleNames = new Set<string>();
  const sectionIds = new Set<string>();
  const surfaces = registrations.map(({ manifest, surface }) => {
    if (surface.moduleName !== manifest.moduleName) {
      throw new Error(
        `Frontend module surface ${surface.moduleName} does not match manifest ${manifest.moduleName}`,
      );
    }
    if (surface.id !== manifest.sectionId) {
      throw new Error(
        `Frontend section ${surface.id} does not match manifest section ${manifest.sectionId}`,
      );
    }
    if (moduleNames.has(surface.moduleName)) {
      throw new Error(`Duplicate frontend module surface: ${surface.moduleName}`);
    }
    if (sectionIds.has(surface.id)) {
      throw new Error(`Duplicate frontend module section: ${surface.id}`);
    }
    moduleNames.add(surface.moduleName);
    sectionIds.add(surface.id);
    return surface as ValidatedModuleSurface;
  });
  return surfaces.sort(
    (left, right) =>
      (left.order ?? 100) - (right.order ?? 100)
      || left.id.localeCompare(right.id),
  );
}

export const moduleSurfaces = validateModuleSurfaceCatalog(generatedModuleSurfaceCatalog);

export const moduleSections: Array<Option<Section>> = moduleSurfaces.map(
  ({ id, label, icon }) => ({ id, label, icon }),
);

export function renderModuleSurface(section: Section, workbench: Workbench): ReactNode {
  return moduleSurfaces.find((surface) => surface.id === section)?.render(workbench) ?? null;
}
