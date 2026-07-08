import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contact, contactGroup, organizationContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(resetContactsWorkspaceTest);

describe("ContactsWorkspace relationship and group interactions", () => {
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
    }, contact], { onUpdateRelationship, onRemoveRelationship });

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
      groups: [{ id: "group-existing", name: "Review list", visibility_scope: "organization", member_id: "member-1", created_at: "2026-07-07T00:00:00Z" }]
    }], {
      contactGroups: [contactGroup, { id: "group-existing", name: "Review list", kind: "manual", visibility_scope: "organization", status: "active", member_count: 1 }],
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
});
