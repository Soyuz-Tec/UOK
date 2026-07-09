import { fireEvent, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace group detail behavior", () => {
  it("separates user groups from generated system labels in the detail profile", () => {
    const onRemoveSelectedContactFromGroup = vi.fn();
    renderContactsWorkspace("split", [{
      ...contact,
      groups: [
        {
          id: "group-user",
          name: "Important contacts",
          visibility_scope: "organization",
          member_id: "member-user",
          created_at: "2026-07-07T00:00:00Z"
        },
        {
          id: "group-company",
          name: "Company: Example Organization",
          visibility_scope: "organization",
          member_id: "member-company",
          created_at: "2026-07-07T00:00:00Z"
        },
        {
          id: "group-review",
          name: "Review: Ready",
          visibility_scope: "organization",
          member_id: "member-review",
          created_at: "2026-07-07T00:00:00Z"
        }
      ]
    }], { onRemoveSelectedContactFromGroup });

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));

    const inspector = screen.getByLabelText("Contact inspector");
    expect(within(inspector).getAllByText("Important contacts").length).toBeGreaterThan(0);
    expect(within(inspector).getByText("System labels")).toBeInTheDocument();
    expect(within(inspector).getByText("Company: Example Organization")).toBeInTheDocument();
    expect(within(inspector).getByText("Review: Ready")).toBeInTheDocument();

    fireEvent.click(within(inspector).getByRole("button", { name: "Remove Example Contact from Company: Example Organization" }));
    expect(onRemoveSelectedContactFromGroup).toHaveBeenCalledWith("group-company");
  });
});
