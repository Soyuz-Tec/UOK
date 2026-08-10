import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModuleStatus } from "@uok/shared/types";

import { AppsManagerPanel } from "../../web/src/AppsManagerPanel";

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
  it("organizes module search filters sorting grouping and saved views in the command surface", () => {
    const rows = [
      moduleStatus({ name: "contacts.core", status: "available", maturity: "runtime_proven" }),
      moduleStatus({ name: "calendar.core", status: "installed", maturity: "integration_tested" }),
      moduleStatus({ name: "agents.core", status: "available", maturity: "integration_tested" }),
    ];
    const { container } = render(<AppsManagerPanel modules={rows} busyAction="" onAction={vi.fn()} />);

    expect(screen.getByLabelText("Apps Manager controls")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search options: All modules" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search modules" }), { target: { value: "agents" } });
    expect(screen.getByRole("listitem", { name: /agents\.core available/i })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /contacts\.core/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search modules" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "installed" } });
    expect(screen.getByRole("listitem", { name: /calendar\.core installed/i })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /contacts\.core/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Saved search name"), { target: { value: "Installed modules" } });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));
    expect(screen.getByRole("button", { name: "Apply Installed modules" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Maturity" }));
    expect(screen.getByRole("list", { name: "Runtime proven" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Integration tested" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Module sort field"), { target: { value: "name" } });
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    expect(Array.from(container.querySelectorAll(".module-row .module-name"), (node) => node.textContent)).toEqual([
      "contacts.core",
      "calendar.core",
      "agents.core",
    ]);
  });

  it("shows planned maturity without offering lifecycle actions", () => {
    const onAction = vi.fn();
    render(<AppsManagerPanel
      modules={[moduleStatus({
        name: "future.core",
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

    const row = screen.getByRole("listitem", { name: /future\.core planned, maturity planned/i });
    expect(within(row).getByText(/Maturity: planned/)).toBeInTheDocument();
    expect(within(row).getByText(/maintenance unavailable/)).toBeInTheDocument();
    expect(within(row).getByText(/Recorded status: upgraded/)).toBeInTheDocument();
    expect(within(row).getByText("reconciliation required")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Reconcile" }));
    expect(onAction).toHaveBeenCalledWith("future.core", "reconcile");
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
