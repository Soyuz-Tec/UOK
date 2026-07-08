import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contact, contactGroup, organizationContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

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

  it("shows related contact names in the relationships pane", () => {
    renderContactsWorkspace("split", [{
      ...contact,
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
      }]
    }, organizationContact]);

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));
    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));

    const inspector = screen.getByLabelText("Contact inspector");
    const relationshipRow = within(inspector).getByText("ops@avalon.example").closest(".relationship-row");
    expect(relationshipRow).not.toBeNull();
    expect(within(relationshipRow as HTMLElement).getByText("Avalon Bear Hill")).toBeInTheDocument();
    expect(within(relationshipRow as HTMLElement).getByText("Works For · Organization")).toBeInTheDocument();
  });

  it("edits and unlinks relationship rows without leaving the contact workspace", async () => {
    const onUpdateRelationship = vi.fn().mockResolvedValue(undefined);
    const onRemoveRelationship = vi.fn().mockResolvedValue(undefined);
    renderContactsWorkspace("split", [{
      ...organizationContact,
      relationships: [{
        id: "relationship-1",
        from_party_id: contact.id,
        to_party_id: organizationContact.id,
        relationship_type: "primary_contact",
        direction: "inbound",
        related_party_id: contact.id,
        related_party_name: contact.display_name,
        related_party_type: contact.party_type,
        related_party_email: contact.email
      }]
    }, contact], {
      onUpdateRelationship,
      onRemoveRelationship
    });

    fireEvent.click(screen.getByRole("button", { name: /Avalon Bear Hill/i }));
    fireEvent.click(screen.getByRole("button", { name: "Relationships" }));

    const inspector = screen.getByLabelText("Contact inspector");
    const relationshipRow = within(inspector).getByText(contact.email || "").closest(".relationship-row") as HTMLElement;
    fireEvent.click(within(relationshipRow).getByLabelText("Edit relationship with Example Contact"));
    const relationshipSelector = within(relationshipRow).getByLabelText("Relationship");
    expect(within(relationshipSelector).getByRole("option", { name: "Finance contact" })).toBeInTheDocument();
    expect(within(relationshipSelector).getByRole("option", { name: "Supplier contact" })).toBeInTheDocument();
    fireEvent.change(relationshipSelector, { target: { value: "billing_contact" } });
    fireEvent.click(within(relationshipRow).getByLabelText("Save relationship"));

    await waitFor(() => expect(onUpdateRelationship).toHaveBeenCalledWith("relationship-1", contact.id, organizationContact.id, "billing_contact"));

    fireEvent.click(within(relationshipRow).getByLabelText("Unlink Example Contact"));
    await waitFor(() => expect(onRemoveRelationship).toHaveBeenCalledWith("relationship-1"));
  });

  it("adds and removes contact group memberships from the contact workspace", async () => {
    const onAddSelectedContactToGroup = vi.fn().mockResolvedValue(undefined);
    const onRemoveSelectedContactFromGroup = vi.fn().mockResolvedValue(undefined);
    renderContactsWorkspace("split", [{
      ...contact,
      groups: [{
        id: "group-existing",
        name: "Review list",
        visibility_scope: "organization",
        member_id: "member-1",
        created_at: "2026-07-07T00:00:00Z"
      }]
    }], {
      contactGroups: [contactGroup, {
        id: "group-existing",
        name: "Review list",
        kind: "manual",
        visibility_scope: "organization",
        status: "active",
        member_count: 1
      }],
      onAddSelectedContactToGroup,
      onRemoveSelectedContactFromGroup
    });

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));

    const inspector = screen.getByLabelText("Contact inspector");
    expect(within(inspector).getByText("Review list")).toBeInTheDocument();

    fireEvent.click(within(inspector).getByLabelText("Remove Example Contact from Review list"));
    await waitFor(() => expect(onRemoveSelectedContactFromGroup).toHaveBeenCalledWith("group-existing"));

    fireEvent.change(within(inspector).getByLabelText("Add to group"), { target: { value: contactGroup.id } });
    fireEvent.click(within(inspector).getByLabelText("Add contact to selected group"));
    await waitFor(() => expect(onAddSelectedContactToGroup).toHaveBeenCalledWith(contactGroup.id));
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
    expect(within(dialog).getByRole("button", { name: /Source details/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /More details/i }));
    expect(within(dialog).getByLabelText("Website")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Dates/i }));
    expect(within(dialog).getByLabelText("Birthday")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Messaging and tags/i }));
    expect(within(dialog).getByLabelText("Tags")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Source details/i }));
    expect(within(dialog).getByLabelText("Source")).toBeInTheDocument();
  });

  it("runs smart contact grouping from the group rail", async () => {
    const onGroupContactsBySmartRules = vi.fn();
    renderContactsWorkspace("table", [contact, organizationContact], { onGroupContactsBySmartRules });

    fireEvent.click(screen.getByRole("button", { name: "Smart groups" }));

    await waitFor(() => expect(onGroupContactsBySmartRules).toHaveBeenCalledTimes(1));
  });
});
