import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModuleStatus } from "@uok/shared/types";
import { PlanningModuleState } from "../../web/src/PlanningModuleState";


function moduleRow(name: string, status: string, dependencies: string[] = []): ModuleStatus {
  return {
    name,
    status,
    recorded_status: status,
    reconciliation_required: false,
    maturity: "runtime_proven",
    version: "3.1.0-alpha.3",
    kind: "capability_module",
    installable: true,
    uninstallable: true,
    updatable: true,
    maintainable: true,
    required: false,
    lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
    lifecycle_state_declared: true,
    dependencies,
    dependents: [],
  };
}

describe("PlanningModuleState", () => {
  it("installs the first unavailable declared dependency", () => {
    const onActivate = vi.fn();
    const planning = moduleRow("planning.core", "available", ["calendar.core"]);
    render(
      <PlanningModuleState
        module={planning}
        moduleRows={[planning, moduleRow("calendar.core", "available")]}
        busyAction=""
        onActivate={onActivate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Install calendar.core" }));
    expect(onActivate).toHaveBeenCalledWith("calendar.core", "install");
  });

  it("activates Planning only after every declared dependency is operational", () => {
    const onActivate = vi.fn();
    const planning = moduleRow("planning.core", "disabled", ["calendar.core"]);
    render(
      <PlanningModuleState
        module={planning}
        moduleRows={[planning, moduleRow("calendar.core", "installed")]}
        busyAction=""
        onActivate={onActivate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(onActivate).toHaveBeenCalledWith("planning.core", "enable");
  });
});
