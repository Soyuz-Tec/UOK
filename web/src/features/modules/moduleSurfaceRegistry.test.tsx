import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { lazy, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  GeneratedModuleSurfaceRegistration,
  ModuleSurface,
  ModuleSurfaceHostContext,
  ModuleSurfaceRenderContext,
} from "@uok/contracts/moduleSurface";
import {
  ModuleSurfaceOutlet,
  moduleSurfaces,
  validateModuleSurfaceCatalog,
} from "./moduleSurfaceRegistry";


const Icon = () => null;
const host: ModuleSurfaceHostContext = {
  session: {
    token: "test-token",
    generation: 0,
    onUnauthorized: vi.fn(),
  },
  currentUserRole: "platform_admin",
  appearance: "system",
  moduleRows: [],
  busyAction: "",
  moduleAction: vi.fn(),
  refreshHost: vi.fn(),
  moduleRefreshRevision: 0,
};

function StatefulSurface({
  label,
  onUnmount,
  surfaceActive,
}: {
  label: string;
  onUnmount?: () => void;
  surfaceActive: boolean;
}) {
  const [value, setValue] = useState("");
  useEffect(() => () => onUnmount?.(), [onUnmount]);
  return (
    <label>
      {label}
      <output aria-label={`${label} activity`}>
        {surfaceActive ? "active" : "hidden"}
      </output>
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
    const onAppsUnmount = vi.fn();
    const surfaces = validateModuleSurfaceCatalog([
      registration("apps.manager", "apps", {
        render: ({ surfaceActive }: ModuleSurfaceRenderContext) => (
          <StatefulSurface
            label="Apps"
            onUnmount={onAppsUnmount}
            surfaceActive={surfaceActive}
          />
        ),
      }),
      registration("calendar.core", "calendar", {
        render: ({ surfaceActive }: ModuleSurfaceRenderContext) => (
          <StatefulSurface label="Calendar" surfaceActive={surfaceActive} />
        ),
      }),
    ]);
    const { rerender, unmount } = render(
      <ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />,
    );

    expect(screen.queryByLabelText("Calendar value")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Apps activity")).toHaveTextContent("active");
    fireEvent.change(screen.getByLabelText("Apps value"), { target: { value: "unsaved" } });

    rerender(<ModuleSurfaceOutlet section="calendar" host={host} surfaces={surfaces} />);
    expect(screen.getByLabelText("Calendar value")).toBeVisible();
    expect(screen.getByLabelText("Apps value")).not.toBeVisible();
    expect(screen.getByLabelText("Apps activity")).toHaveTextContent("hidden");
    expect(screen.getByLabelText("Calendar activity")).toHaveTextContent("active");

    rerender(<ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />);
    expect(screen.getByLabelText("Apps value")).toHaveValue("unsaved");
    expect(screen.getByLabelText("Apps activity")).toHaveTextContent("active");
    expect(screen.getByLabelText("Calendar activity")).toHaveTextContent("hidden");
    expect(onAppsUnmount).not.toHaveBeenCalled();

    unmount();
    expect(onAppsUnmount).toHaveBeenCalledTimes(1);
  });

  it("announces an asynchronously loaded module surface", async () => {
    let resolveModule!: (value: { default: ComponentType }) => void;
    const LazySurface = lazy(() => new Promise<{ default: ComponentType }>((resolve) => { resolveModule = resolve; }));
    const surfaces = validateModuleSurfaceCatalog([
      registration("apps.manager", "apps", {
        label: "Apps Manager",
        render: () => <LazySurface />,
      }),
    ]);
    render(<ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Apps Manager");
    await act(async () => resolveModule({ default: () => <p>Loaded module</p> }));
    expect(await screen.findByText("Loaded module")).toBeInTheDocument();
  });

  it("contains a module render failure and allows a bounded retry", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;
    const surfaces = validateModuleSurfaceCatalog([
      registration("apps.manager", "apps", {
        label: "Apps Manager",
        render: () => <FailingSurface shouldThrow={shouldThrow} />,
      }),
    ]);

    render(<ModuleSurfaceOutlet section="apps" host={host} surfaces={surfaces} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Apps Manager could not open");
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered module")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});

function FailingSurface({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Module render failed.");
  return <p>Recovered module</p>;
}
