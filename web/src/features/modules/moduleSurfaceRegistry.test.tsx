import { describe, expect, it } from "vitest";

import type { GeneratedModuleSurfaceRegistration, ModuleSurface } from "./moduleSurfaceContract";
import { moduleSurfaces, validateModuleSurfaceCatalog } from "./moduleSurfaceRegistry";


const Icon = () => null;

function registration(
  moduleName: string,
  sectionId: "apps" | "calendar",
  surfaceOverrides: Partial<ModuleSurface> = {},
): GeneratedModuleSurfaceRegistration {
  return {
    manifest: {
      moduleName,
      sectionId,
      webEntry: `modules/${moduleName}/web/src/moduleSurface.tsx`,
      dependencies: [],
    },
    surface: {
      moduleName,
      id: sectionId,
      label: sectionId,
      icon: Icon,
      render: () => null,
      ...surfaceOverrides,
    },
  };
}

describe("module surface registry", () => {
  it("composes the checked-in manifest catalog in UI order", () => {
    expect(moduleSurfaces.map(({ moduleName, id }) => [moduleName, id])).toEqual([
      ["apps.manager", "apps"],
      ["contacts.core", "contacts"],
      ["calendar.core", "calendar"],
      ["communications.core", "communications"],
      ["planning.core", "planning"],
    ]);
  });

  it("rejects a descriptor whose identity differs from its manifest", () => {
    expect(() => validateModuleSurfaceCatalog([
      registration("apps.manager", "apps", { moduleName: "other.core" }),
    ])).toThrow("does not match manifest");
  });

  it("rejects duplicate module and section registrations", () => {
    expect(() => validateModuleSurfaceCatalog([
      registration("apps.manager", "apps"),
      registration("apps.manager", "calendar"),
    ])).toThrow("Duplicate frontend module surface");

    expect(() => validateModuleSurfaceCatalog([
      registration("apps.manager", "apps"),
      registration("calendar.core", "apps"),
    ])).toThrow("Duplicate frontend module section");
  });
});
