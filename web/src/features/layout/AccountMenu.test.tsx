import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "../../shared/localization";
import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  it("uses the shared alert dialog for logout and restores focus after cancel", async () => {
    const onSignOut = vi.fn();
    render(
      <UokLocalizationProvider locale="en-US">
        <AccountMenu
          user={{
            username: "admin",
            display_name: "Admin User",
            email: "admin@example.com",
            role: "administrator",
          }}
          appearance="system"
          locale="en-US"
          busy={false}
          onAppearanceChange={vi.fn()}
          onLocaleChange={vi.fn()}
          onRefresh={vi.fn()}
          onSignOut={onSignOut}
        />
      </UokLocalizationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open account menu for Admin User/i }));
    const logout = within(screen.getByRole("menu", { name: "Account menu" }))
      .getByRole("menuitem", { name: "Logout" });
    logout.focus();
    fireEvent.click(logout);

    const dialog = screen.getByRole("alertdialog", { name: "Logout" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("End this session and return to the login screen?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(logout).toHaveFocus();
    expect(onSignOut).not.toHaveBeenCalled();

    fireEvent.click(logout);
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Logout" }))
      .getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
  });
});
