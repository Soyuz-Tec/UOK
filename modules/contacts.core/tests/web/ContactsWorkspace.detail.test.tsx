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

  it("confirms recoverable contact Delete while keeping permanent Purge distinct", async () => {
    const onArchive = vi.fn();
    const onPurge = vi.fn();
    renderContactsWorkspace("table", [contact], { onArchive, onPurge });

    fireEvent.click(screen.getByRole("row", { name: "Open Example Contact" }));
    const detail = screen.getByRole("dialog", { name: "Contact details" });

    expect(within(detail).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Purge" })).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: "Delete" }));

    let confirmation = await screen.findByRole("dialog", { name: "Confirm contact deletion" });
    expect(confirmation).toHaveTextContent("Delete “Example Contact” from active use?");
    expect(confirmation).toHaveTextContent("group memberships, and audit history remain");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(detail).getByRole("button", { name: "Delete" })).toHaveFocus());
    expect(onArchive).not.toHaveBeenCalled();

    fireEvent.click(within(detail).getByRole("button", { name: "Delete" }));
    confirmation = await screen.findByRole("dialog", { name: "Confirm contact deletion" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onArchive).toHaveBeenCalledTimes(1));
    expect(onPurge).not.toHaveBeenCalled();
  });

  it("fails closed when the contact read model does not grant lifecycle actions", () => {
    renderContactsWorkspace("table", [{ ...contact, can_delete: false, can_restore: false, can_purge: false }]);
    fireEvent.click(screen.getByRole("row", { name: "Open Example Contact" }));
    const detail = screen.getByRole("dialog", { name: "Contact details" });

    expect(within(detail).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Purge" })).not.toBeInTheDocument();
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

  it("loads and pages the server-recorded contact activity timeline", async () => {
    const activityRows = Array.from({ length: 11 }, (_, index) => ({
      id: `activity-${index + 1}`,
      party_id: contact.id,
      actor_user_id: index ? "user-1" : null,
      activity_type: index === 0 ? "ContactImported" : "ContactUpdated",
      object_type: "Party",
      object_id: contact.id,
      summary: `Server activity ${index + 1}`,
      payload: index === 0 ? { source: "csv_import" } : {},
      occurred_at: `2026-07-${String(13 - index).padStart(2, "0")}T00:00:00Z`
    }));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/contacts/saved-views") return response([]);
      if (path.includes(`/api/contacts/${contact.id}/activity?`)) {
        const params = new URLSearchParams(path.split("?")[1]);
        const limit = Number(params.get("limit"));
        const offset = Number(params.get("offset"));
        return response(activityRows.slice(offset, offset + limit), 200, { "X-Total-Count": String(activityRows.length) });
      }
      return response({ detail: "Unexpected request" }, 500);
    }));
    renderContactsWorkspace("split", [{
      ...contact,
      notes: [{ id: "note-client-only", body: "Client-only synthetic note", created_at: "2026-07-07T00:00:00Z" }]
    }, organizationContact]);

    fireEvent.click(screen.getByRole("button", { name: /Example Contact/i }));
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));

    const timeline = within(screen.getByLabelText("Contact inspector")).getByLabelText("Contact activity timeline");
    expect(within(timeline).getByText("Activity history")).toBeInTheDocument();
    expect(await within(timeline).findByText("Server activity 1")).toBeInTheDocument();
    expect(within(timeline).queryByText("Client-only synthetic note")).not.toBeInTheDocument();
    expect(within(timeline).getByLabelText("Activity paging")).toBeInTheDocument();
    fireEvent.click(within(timeline).getByRole("button", { name: "Next" }));
    expect(await within(timeline).findByText("Server activity 11")).toBeInTheDocument();
    expect(within(timeline).queryByText("Server activity 1")).not.toBeInTheDocument();
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
    const menu = screen.getByRole("dialog", { name: "Visible contact fields" });
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
});

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}
