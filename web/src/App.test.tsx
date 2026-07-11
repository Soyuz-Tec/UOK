import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMemoryStorage } from "./shared/storage";

describe("UOK app", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders only the centered auth surface before login", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { name: "Unified Operating Kernel" })).toBeInTheDocument();
    expect(container.querySelector(".auth-mark")).toHaveTextContent("K");
    expect(screen.getByRole("tab", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Register" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email or username")).toBeInTheDocument();
    expect(screen.queryByText("Apps Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("Contacts")).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(String.fromCharCode(67, 108, 101, 97, 110, 45, 82, 111, 111, 109, 32, 75, 101, 114, 110, 101, 108), "i"))).not.toBeInTheDocument();
    expect(screen.queryByText(/Initial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(String.fromCharCode(85, 79, 75, 114, 111, 111, 109), "i"))).not.toBeInTheDocument();
  });

  it("opens and dismisses the signed-in account menu", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes("/api/dashboard")
        ? { counts: {} }
        : path.includes("/api/modules/catalog")
          ? {
              modules: {
                "contacts.core": {
                  name: "contacts.core",
                  status: "installed",
                  recorded_status: "installed",
                  reconciliation_required: false,
                  maturity: "runtime_proven",
                  version: "1.0.0",
                  kind: "capability_module",
                  installable: true,
                  uninstallable: true,
                  updatable: true,
                  maintainable: true,
                  required: false,
                  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
                  lifecycle_state_declared: true,
                  dependencies: [],
                  dependents: []
                }
              }
            }
          : [];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => body
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("uok_token", "local-test-token");
    localStorage.setItem("uok_user", JSON.stringify({
      username: "admin",
      display_name: "Admin User",
      email: "admin@example.com",
      role: "administrator"
    }));

    const { container } = render(<App />);
    expect(container.querySelector(".brand-mark")).toHaveTextContent("K");

    expect(container.querySelector(".shell")).not.toHaveClass("sidebar-collapsed");
    const collapseToggle = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(collapseToggle);
    expect(container.querySelector(".shell")).toHaveClass("sidebar-collapsed");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("uok_sidebar_collapsed")).toBe("true");

    const trigger = screen.getByRole("button", { name: /Open account menu for Admin User/i });
    fireEvent.click(trigger);

    const menu = screen.getByRole("menu", { name: "Account menu" });
    expect(within(menu).getByRole("menuitemradio", { name: "System" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "English" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "العربية" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "rtl"));
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(localStorage.getItem("uok_locale")).toBe("ar");
    expect(screen.getByRole("button", { name: "التخطيط" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "English" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("dir", "ltr"));
    expect(within(menu).getByRole("menuitem", { name: "Refresh" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
    expect(within(menu).queryByText("Admin User")).not.toBeInTheDocument();
    expect(within(menu).queryByText("admin@example.com")).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Profile" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Usage" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Invite User" })).not.toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument());

    expect(screen.queryByText("Module catalog")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest command or API response")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.queryByText("Release gates")).not.toBeInTheDocument();
    expect(screen.queryByText("Current organization")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    expect(screen.queryByText("Baseline verification")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Architecture" }));
    expect(screen.queryByText("Architecture alignment")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contacts" }));
    expect(screen.queryByText("Data workflow")).not.toBeInTheDocument();
    expect(container.querySelector(".contacts-header")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add new" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New contact" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "New" })).not.toBeInTheDocument();
  });
});
