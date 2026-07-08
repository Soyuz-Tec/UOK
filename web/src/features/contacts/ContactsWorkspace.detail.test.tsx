import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contact, organizationContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace detail and editor surfaces", () => {
  it("opens contact detail in a reusable popup from table view", () => {
    renderContactsWorkspace("table");

    expect(screen.queryByRole("dialog", { name: "Contact details" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("row", { name: "Open Example Contact" }));

    const dialog = screen.getByRole("dialog", { name: "Contact details" });
    expect(within(dialog).queryByText("Contact workspace")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Workspace editor")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Example Contact")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contact inspector")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Create or edit contact" })).toBeInTheDocument();
    expect(screen.queryByText("Contact editor")).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Contact form" })).toBeInTheDocument();
  });

  it("keeps ready contact details low-noise and collapses technical metadata", () => {
    renderContactsWorkspace("table");

    fireEvent.click(screen.getByRole("row", { name: "Open Example Contact" }));

    const dialog = screen.getByRole("dialog", { name: "Contact details" });
    expect(within(dialog).getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Ready for use")).not.toBeInTheDocument();
    expect(within(dialog).getByText("100 Example Street")).toBeInTheDocument();
    expect(within(dialog).getByText("Technical details")).toBeInTheDocument();
  });

  it("shows the business intelligence profile pane in the contact inspector", () => {
    renderContactsWorkspace("split");

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));
    fireEvent.click(screen.getByRole("button", { name: "Intelligence" }));

    const inspector = screen.getByLabelText("Contact inspector");
    expect(within(inspector).getByLabelText("Business intelligence profile")).toBeInTheDocument();
    expect(within(inspector).getByText("Ready contact")).toBeInTheDocument();
    expect(within(inspector).getByText("Signals")).toBeInTheDocument();
  });

  it("shows a unified contact activity timeline", () => {
    renderContactsWorkspace("split", [{
      ...contact,
      source: "csv_import",
      attrs: {
        merge_history: [{
          merge_id: "merge-1",
          duplicate_display_name: "Duplicate Example",
          merged_at: "2026-07-07T00:00:00Z"
        }]
      },
      notes: [{ id: "note-1", body: "Known from supplier onboarding.", created_at: "2026-07-07T00:00:00Z" }],
      groups: [{
        id: "group-existing",
        name: "Review list",
        visibility_scope: "organization",
        member_id: "member-1",
        created_at: "2026-07-07T00:00:00Z"
      }],
      relationships: [{
        id: "relationship-1",
        from_party_id: contact.id,
        to_party_id: organizationContact.id,
        relationship_type: "works_for",
        direction: "outbound",
        related_party_id: organizationContact.id,
        related_party_name: organizationContact.display_name,
        related_party_type: organizationContact.party_type,
        related_party_email: organizationContact.email
      }],
      duplicate_candidates: [{ id: "duplicate-1", display_name: "Duplicate Example", reason: "email" }]
    }, organizationContact]);

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));

    const timeline = within(screen.getByLabelText("Contact inspector")).getByLabelText("Contact activity timeline");
    expect(within(timeline).getByText("Why this contact exists")).toBeInTheDocument();
    expect(within(timeline).getByText("Imported for review")).toBeInTheDocument();
    expect(within(timeline).getByText("Known from supplier onboarding.")).toBeInTheDocument();
    expect(within(timeline).getByText("Works For")).toBeInTheDocument();
    expect(within(timeline).getByText("Review list")).toBeInTheDocument();
    expect(within(timeline).getByText("Duplicate candidate")).toBeInTheDocument();
    expect(within(timeline).getByText("Merged Duplicate Example")).toBeInTheDocument();
  });

  it("opens contact detail in the same popup primitive from cards view", () => {
    renderContactsWorkspace("cards");

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));

    expect(screen.getByRole("dialog", { name: "Contact details" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Contact inspector")).not.toBeInTheDocument();
  });

  it("keeps the persistent inspector only for list and detail view", () => {
    renderContactsWorkspace("split");

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));

    expect(screen.queryByRole("dialog", { name: "Contact details" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contact inspector")).toBeInTheDocument();
  });

  it("keeps List and Detail rows focused on selection identity", () => {
    renderContactsWorkspace("split", [organizationContact, contact]);

    const results = screen.getByLabelText("Contact results");
    expect(within(results).getByText("Name")).toBeInTheDocument();
    expect(within(results).getByText("Organization")).toBeInTheDocument();
    expect(within(results).getByText("Example Organization")).toBeInTheDocument();
    expect(within(results).queryByText(contact.email || "")).not.toBeInTheDocument();
    const organizationRow = within(results).getByText("Example Organization").closest("button");
    expect(organizationRow).not.toHaveTextContent("Example OrganizationOrganization");

    fireEvent.click(within(results).getByRole("button", { name: /Example Contact/i }));

    const inspector = screen.getByLabelText("Contact inspector");
    expect(within(inspector).getAllByText(contact.email || "").length).toBeGreaterThan(0);
  });

  it("lets users choose the List and Detail display field lane", () => {
    renderContactsWorkspace("split", [contact]);

    const results = screen.getByLabelText("Contact results");
    expect(within(results).getByText("Organization")).toBeInTheDocument();
    expect(within(results).getByText("Example Organization")).toBeInTheDocument();
    expect(within(results).queryByText(contact.email || "")).not.toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "Fields" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Fields" }));
    const menu = screen.getByRole("group", { name: "Visible contact fields" });
    fireEvent.click(within(menu).getByLabelText("Organization"));
    fireEvent.click(within(menu).getByLabelText("Email"));

    expect(results.querySelector(".contact-list-display-header > span")).toHaveTextContent("Email");
    expect(within(results).getByText(contact.email || "")).toBeInTheDocument();
    expect(within(results).queryByText("Example Organization")).not.toBeInTheDocument();
  });

  it("starts a new contact from a clean addable form in popup views", () => {
    renderContactsWorkspace("table");

    fireEvent.click(screen.getByRole("button", { name: "New contact" }));

    const dialog = screen.getByRole("dialog", { name: "Create or edit contact" });
    expect(within(dialog).getByText("New contact")).toBeInTheDocument();
    expect(within(dialog).getByText("Add at least one name, organization, contact method, or note.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Person details/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Organization details/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Dates/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Messaging and tags/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Governance details/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /More details/i }));
    expect(within(dialog).getByLabelText("Website")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Dates/i }));
    expect(within(dialog).getByLabelText("Birthday")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Messaging and tags/i }));
    expect(within(dialog).getByLabelText("Tags")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Governance details/i }));
    expect(within(dialog).getByLabelText("Source")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Consent")).toBeInTheDocument();
  });

  it("runs smart contact grouping from the group rail", async () => {
    const onGroupContactsBySmartRules = vi.fn();
    renderContactsWorkspace("table", [contact, organizationContact], { onGroupContactsBySmartRules });

    fireEvent.click(screen.getByRole("button", { name: "Smart groups" }));

    await waitFor(() => expect(onGroupContactsBySmartRules).toHaveBeenCalledTimes(1));
  });
});
