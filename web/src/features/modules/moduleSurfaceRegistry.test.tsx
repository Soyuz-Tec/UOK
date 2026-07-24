import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  GeneratedModuleSurfaceRegistration,
  ModuleSurface,
  ModuleSurfaceHostContext,
} from "@uok/contracts/moduleSurface";
import {
  ModuleSurfaceOutlet,
  moduleSurfaces,
  validateModuleSurfaceCatalog,
} from "./moduleSurfaceRegistry";


const Icon = () => null;
const host: ModuleSurfaceHostContext = {
  token: "test-token",
  currentUserRole: "platform_admin",
  appearance: "system",
  moduleRows: [],
  busyAction: "",
  moduleAction: vi.fn(),
  refreshHost: vi.fn(),
  moduleRefreshRevision: 0,
  onUnauthorized: vi.fn(),
};

function StatefulSurface({ label }: { label: string }) {
  const [value, setValue] = useState("");
  return (
    <label>
      {label}
      <input
        aria-label={`${label} value`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
}

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
      ["product.master", "products"],
      ["compliance.core", "compliance"],
      ["locations.core", "locations"],
      ["routes.core", "routes"],
      ["shipments.core", "shipments"],
      ["calendar.core", "calendar"],
      ["intelligence.core", "intelligence"],
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

  it("mounts module surfaces lazily and retains visited module state", () => {
    const surfaces = validateModuleSurfaceCatalog([
      registration("apps.manager", "apps", {
        render: () => <StatefulSurface label="Apps" />,
      }),
      registration("calendar.core", "calendar", {
        render: () => <StatefulSurface label="Calendar" />,
      }),
    ]);
    const { rerender } = render(
      <ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />,
    );

    expect(screen.queryByLabelText("Calendar value")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Apps value"), { target: { value: "unsaved" } });

    rerender(<ModuleSurfaceOutlet section="calendar" host={host} surfaces={surfaces} />);
    expect(screen.getByLabelText("Calendar value")).toBeVisible();
    expect(screen.getByLabelText("Apps value")).not.toBeVisible();

    rerender(<ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />);
    expect(screen.getByLabelText("Apps value")).toHaveValue("unsaved");
  });
});
