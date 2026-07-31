import { useRef } from "react";

import type {
  GeneratedModuleSurfaceRegistration,
  ModuleSurface,
  ModuleSurfaceHostContext,
  ModuleSurfaceRenderContext,
} from "@uok/contracts/moduleSurface";
import { generatedModuleSurfaceCatalog } from "@uok/generated/moduleSurfaceCatalog";
import { ModuleErrorBoundary } from "@uok/shared/feedback";
import type { Option } from "@uok/shared/options";
import type { Section } from "@uok/shared/types";

type ValidatedModuleSurface = Omit<ModuleSurface, "id"> & { id: Section };

function ModuleSurfaceRenderer({
  host,
  surface,
  surfaceActive,
}: {
  host: ModuleSurfaceHostContext;
  surface: ValidatedModuleSurface;
  surfaceActive: boolean;
}) {
  const renderContext: ModuleSurfaceRenderContext = {
    ...host,
    surfaceActive,
  };
  return surface.render(renderContext);
}

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

export function ModuleSurfaceOutlet({
  section,
  host,
  surfaces = moduleSurfaces,
}: {
  section: Section;
  host: ModuleSurfaceHostContext;
  surfaces?: readonly ValidatedModuleSurface[];
}) {
  const visited = useRef(new Set<Section>());
  const activeSurface = surfaces.find((surface) => surface.id === section);
  if (activeSurface) visited.current.add(activeSurface.id);

  return (
    <>
      {surfaces
        .filter((surface) => visited.current.has(surface.id))
        .map((surface) => {
          const active = surface.id === section;
          return (
            <div
              key={surface.id}
              aria-hidden={!active}
              data-module-surface={surface.id}
              style={{ display: active ? "contents" : "none" }}
            >
              <ModuleErrorBoundary active={active} moduleLabel={surface.label}>
                <ModuleSurfaceRenderer
                  host={host}
                  surface={surface}
                  surfaceActive={active}
                />
              </ModuleErrorBoundary>
            </div>
          );
        })}
    </>
  );
}
