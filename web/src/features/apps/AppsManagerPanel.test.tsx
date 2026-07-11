import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModuleStatus } from "../../shared/types";
import { AppsManagerPanel } from "./AppsManagerPanel";

afterEach(cleanup);


function moduleStatus(overrides: Partial<ModuleStatus> = {}): ModuleStatus {
  return {
    name: "contacts.core",
    status: "available",
    recorded_status: null,
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
    dependencies: [],
    dependents: [],
    ...overrides,
  };
}


describe("AppsManagerPanel", () => {
  it("shows planned maturity without offering lifecycle actions", () => {
    const onAction = vi.fn();
    render(<AppsManagerPanel
      modules={[moduleStatus({
        name: "agents.core",
        status: "planned",
        recorded_status: "upgraded",
        reconciliation_required: true,
        maturity: "planned",
        installable: false,
        uninstallable: false,
        updatable: false,
        maintainable: false,
        lifecycle: ["planned"],
      })]}
      busyAction=""
      onAction={onAction}
    />);

    const row = screen.getByRole("listitem", { name: /agents\.core planned, maturity planned/i });
    expect(within(row).getByText(/Maturity: planned/)).toBeInTheDocument();
    expect(within(row).getByText(/maintenance unavailable/)).toBeInTheDocument();
    expect(within(row).getByText(/Recorded status: upgraded/)).toBeInTheDocument();
    expect(within(row).getByText("reconciliation required")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Reconcile" }));
    expect(onAction).toHaveBeenCalledWith("agents.core", "reconcile");
    expect(within(row).queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument();
  });

  it("offers install only when the manifest and current status permit it", () => {
    const onAction = vi.fn();
    render(<AppsManagerPanel
      modules={[moduleStatus()]}
      busyAction=""
      onAction={onAction}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(onAction).toHaveBeenCalledWith("contacts.core", "install");
    expect(screen.queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument();
  });

  it("uses enable rather than install for a disabled module", () => {
    render(<AppsManagerPanel
      modules={[moduleStatus({ status: "disabled" })]}
      busyAction=""
      onAction={vi.fn()}
    />);

    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uninstall" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("never offers disable or uninstall for a required module", () => {
    render(<AppsManagerPanel
      modules={[moduleStatus({
        name: "apps.manager",
        status: "installed",
        required: true,
        uninstallable: false,
        lifecycle: ["installed", "upgraded"],
      })]}
      busyAction=""
      onAction={vi.fn()}
    />);

    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uninstall" })).not.toBeInTheDocument();
  });
});
