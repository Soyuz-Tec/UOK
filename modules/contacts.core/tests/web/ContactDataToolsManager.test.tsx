import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { ContactDataToolsManager } from "../../web/src/ContactDataToolsManager";
import { contact, contactGroup, organizationContact } from "./ContactsWorkspace.fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Contacts data and governance tools", () => {
  it("manages first-class facts and append-only consent with governed role controls", async () => {
    const fetchMock = installDataToolsApiMock();
    renderManager();
    const dialog = screen.getByRole("dialog", { name: "Contacts data and governance" });

    expect(await within(dialog).findByText("primary@example.com")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Value"), { target: { value: "other@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add contact fact" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/contact-1/facts", expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "Consent history" }));
    expect(await within(dialog).findByText(/granted · email/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Record a consent decision" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/contact-1/consents", expect.objectContaining({ method: "POST" })));
    const consentCall = fetchMock.mock.calls.find(([path, options]) => String(path).endsWith("/consents") && options?.method === "POST");
    expect(bodyOf(consentCall?.[1])).toEqual(expect.objectContaining({ purpose: "directory_export", channel: "any", status: "pending" }));
  });

  it("keeps governance discoverable but read-only for viewer roles", async () => {
    const fetchMock = installDataToolsApiMock();
    renderManager({ currentUserRole: "viewer" });
    const dialog = screen.getByRole("dialog", { name: "Contacts data and governance" });

    expect(await within(dialog).findByText("primary@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText(/read-only access/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Add contact fact" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Consent history" }));
    expect(within(dialog).getByText(/Contacts consent permission.*not exposed/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/consents"))).toBe(false);
  });

  it("previews, executes, rolls back, exports, and applies selected-contact bulk actions", async () => {
    const fetchMock = installDataToolsApiMock();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:contacts") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderManager();
    const dialog = screen.getByRole("dialog", { name: "Contacts data and governance" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Import, export and bulk" }));
    fireEvent.change(within(dialog).getByLabelText("Source preview"), { target: { value: "Name,Email\nAda,ada@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(importBodies(fetchMock)).toContainEqual(expect.objectContaining({ dry_run: true })));
    expect(await within(dialog).findByText(/Preview · preview-batch/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Execute import" }));
    await waitFor(() => expect(importBodies(fetchMock)).toContainEqual(expect.objectContaining({ dry_run: false })));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Rollback import" }));
    const rollbackConfirmation = await screen.findByRole("dialog", { name: "Confirm action" });
    fireEvent.click(within(rollbackConfirmation).getByRole("button", { name: "Rollback import" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/import-batches/executed-batch/rollback", expect.objectContaining({ method: "POST" })));
    expect(await within(dialog).findByText(/1 rolled back/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "CSV" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith("/api/contacts/export.csv"))).toBe(true));
    fireEvent.change(within(dialog).getByLabelText("Tag"), { target: { value: "priority" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply to selected" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/bulk", expect.objectContaining({ method: "POST" })));
  });

  it("reviews duplicates, defines custom fields, and reports honest interoperability status", async () => {
    const fetchMock = installDataToolsApiMock();
    renderManager();
    const dialog = screen.getByRole("dialog", { name: "Contacts data and governance" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Duplicate review" }));
    expect(await within(dialog).findByText(/Example Contact ↔ Avalon Bear Hill/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Not duplicate" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/duplicate-candidates/candidate-1/resolve", expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "Custom fields" }));
    expect((await within(dialog).findAllByText("Account tier")).length).toBeGreaterThan(0);
    expect(within(within(dialog).getByLabelText("Market segment")).getByRole("option", { name: "Enterprise" })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Field key"), { target: { value: "x" } });
    expect(within(dialog).getByRole("button", { name: "Define custom field" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Field key"), { target: { value: "region_code" } });
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Region code" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Define custom field" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/contacts/custom-fields", expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "Interoperability" }));
    expect(await within(dialog).findByText(/No provider synchronization is active/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText("CARDdav", { exact: false }).length).toBeGreaterThan(0);
  });

  it("deletes and restores contact teams with a reason and the current server ETag", async () => {
    const fetchMock = installDataToolsApiMock();
    renderManager();
    const manager = screen.getByRole("dialog", { name: "Contacts data and governance" });

    fireEvent.click(within(manager).getByRole("button", { name: "Contact teams" }));
    fireEvent.click(await within(manager).findByRole("button", { name: "Delete" }));
    const confirmation = await screen.findByRole("dialog", { name: "Delete contact team" });
    const confirmDelete = within(confirmation).getByRole("button", { name: "Delete" });
    expect(confirmDelete).toBeDisabled();
    fireEvent.change(within(confirmation).getByLabelText("Reason for deletion"), { target: { value: "Team no longer needed" } });
    fireEvent.click(confirmDelete);

    await waitFor(() => expect(fetchMock.mock.calls.some(([path, options]) => path === "/api/contacts/teams/team-1" && options?.method === "DELETE")).toBe(true));
    const deleteCall = fetchMock.mock.calls.find(([path, options]) => path === "/api/contacts/teams/team-1" && options?.method === "DELETE");
    expect(new Headers(deleteCall?.[1]?.headers).get("If-Match")).toBe('"team-etag-1"');
    expect(bodyOf(deleteCall?.[1])).toEqual({ reason: "Team no longer needed" });
    fireEvent.click(await within(manager).findByRole("button", { name: "Restore" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, options]) => path === "/api/contacts/teams/team-1/restore" && options?.method === "POST")).toBe(true));
    const restoreCall = fetchMock.mock.calls.find(([path, options]) => path === "/api/contacts/teams/team-1/restore" && options?.method === "POST");
    expect(new Headers(restoreCall?.[1]?.headers).get("If-Match")).toBe('"team-etag-2"');
  });

  it("reloads stale custom fields, keeps confirmation open, and requires reconfirmation", async () => {
    const fetchMock = installDataToolsApiMock({ staleCustomDeleteOnce: true });
    renderManager();
    const manager = screen.getByRole("dialog", { name: "Contacts data and governance" });

    fireEvent.click(within(manager).getByRole("button", { name: "Custom fields" }));
    const fieldHeadings = await within(manager).findAllByText("Account tier");
    const fieldRecord = fieldHeadings.map((element) => element.closest("article")).find(Boolean);
    expect(fieldRecord).not.toBeNull();
    fireEvent.click(within(fieldRecord as HTMLElement).getByRole("button", { name: "Delete" }));
    const confirmation = await screen.findByRole("dialog", { name: "Delete custom field" });
    fireEvent.change(within(confirmation).getByLabelText("Reason for deletion"), { target: { value: "Field retired" } });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete" }));

    expect(await within(confirmation).findByText(/changed after this action was prepared.*review it/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete custom field" })).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete custom field" })).not.toBeInTheDocument());

    const deleteCalls = fetchMock.mock.calls.filter(([path, options]) => path === "/api/contacts/custom-fields/field-1" && options?.method === "DELETE");
    expect(deleteCalls).toHaveLength(2);
    expect(new Headers(deleteCalls[0][1]?.headers).get("If-Match")).toBe('"field-etag-1"');
    expect(new Headers(deleteCalls[1][1]?.headers).get("If-Match")).toBe('"field-etag-2"');
    expect(within(manager).queryByLabelText("Account tier")).not.toBeInTheDocument();
    fireEvent.click(within(manager).getAllByRole("button", { name: "Restore" })[0]);
    expect(await within(manager).findByLabelText("Account tier")).toHaveValue("preferred");
  });
});

function renderManager({ currentUserRole = "platform_admin" }: { currentUserRole?: string } = {}) {
  return render(<UokLocalizationProvider locale="en-US"><ContactDataToolsManager
    open
    token="token"
    currentUserRole={currentUserRole}
    contacts={[contact, organizationContact]}
    groups={[contactGroup]}
    selectedContact={contact}
    onClose={vi.fn()}
    onChanged={vi.fn()}
  /></UokLocalizationProvider>);
}

function installDataToolsApiMock({ staleCustomDeleteOnce = false }: { staleCustomDeleteOnce?: boolean } = {}) {
  const facts = [{ id: "fact-1", fact_type: "email", label: "work", value: "primary@example.com", is_primary: true, is_verified: true, source: "manual", confidence: "verified" }];
  let teams = [{ id: "team-1", name: "Operations", description: "", status: "active", member_count: 0, members: [], etag: '"team-etag-1"', revision: 1, user_managed: true, can_delete: true, can_restore: false }];
  let customDeleteAttempts = 0;
  let fields = [
    { id: "field-1", field_key: "account_tier", label: "Account tier", field_type: "text", applies_to: "all", required: false, status: "active", options: [], etag: '"field-etag-1"', revision: 1, user_managed: true, can_delete: true, can_restore: false },
    { id: "field-2", field_key: "market_segment", label: "Market segment", field_type: "choice", applies_to: "all", required: false, status: "active", options: ["SMB", "Enterprise"], etag: '"field-2-etag-1"', revision: 1, user_managed: true, can_delete: true, can_restore: false },
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const path = String(input);
    const method = options.method || "GET";
    if (path.endsWith("/facts")) return jsonResponse(method === "POST" ? { ...facts[0], id: "fact-2", value: "other@example.com" } : facts);
    if (path.endsWith("/consents")) return jsonResponse(method === "POST" ? { id: "consent-2" } : [{ id: "consent-1", purpose: "business_operations", channel: "email", status: "granted", legal_basis: "consent", allowed_use: "operations", source: "manual", effective_at: "2026-07-14T00:00:00Z" }]);
    if (path === "/api/contacts/teams?include_archived=true") return jsonResponse(teams);
    if (path === "/api/contacts/teams/team-1" && method === "DELETE") {
      teams = [{ ...teams[0], status: "archived", etag: '"team-etag-2"', revision: 2, can_delete: false, can_restore: true }];
      return jsonResponse(teams[0]);
    }
    if (path === "/api/contacts/teams/team-1/restore" && method === "POST") {
      teams = [{ ...teams[0], status: "active", etag: '"team-etag-3"', revision: 3, can_delete: true, can_restore: false }];
      return jsonResponse(teams[0]);
    }
    if (path.startsWith("/api/contacts/teams")) return jsonResponse(teams);
    if (path === "/api/contacts/import-csv") { const body = bodyOf(options); return jsonResponse({ batch_id: body.dry_run ? "preview-batch" : "executed-batch", dry_run: body.dry_run, validated_count: body.dry_run ? 1 : 0, imported_count: body.dry_run ? 0 : 1 }); }
    if (path.includes("/import-batches/") && path.endsWith("/rows")) return jsonResponse([{ id: "row-1", row_number: 2, requested_operation: "create", applied_operation: "create", status: "validated" }]);
    if (path.endsWith("/rollback")) return jsonResponse({ batch_id: "executed-batch", rolled_back_count: 1, dry_run: false });
    if (path.startsWith("/api/contacts/export.")) return blobResponse("contact export", { "X-Consent-Restricted-Count": "0" });
    if (path === "/api/contacts/bulk") return jsonResponse({ affected_count: 1 });
    if (path.startsWith("/api/contacts/duplicate-candidates?")) return jsonResponse([{ id: "candidate-1", left_party_id: contact.id, right_party_id: organizationContact.id, left_name: contact.display_name, right_name: organizationContact.display_name, score: 90, reasons: ["email"], status: "open" }]);
    if (path.includes("/duplicate-candidates/") && path.endsWith("/resolve")) return jsonResponse({ id: "candidate-1", status: "not_duplicate" });
    if (path === "/api/contacts/custom-fields" && method === "POST") return jsonResponse({ id: "field-3", ...bodyOf(options), status: "active", etag: '"field-3-etag-1"', revision: 1, user_managed: true, can_delete: true, can_restore: false });
    if (path === "/api/contacts/custom-fields?include_archived=true") return jsonResponse(fields);
    if (path === "/api/contacts/custom-fields/field-1" && method === "DELETE") {
      customDeleteAttempts += 1;
      if (staleCustomDeleteOnce && customDeleteAttempts === 1) {
        fields = fields.map((field) => field.id === "field-1" ? { ...field, etag: '"field-etag-2"', revision: 2 } : field);
        return jsonResponse({ detail: { code: "contact_custom_field_precondition_stale", message: "The custom-field definition changed after this action was prepared.", repair: "Review it, then confirm the action again." } }, 412);
      }
      fields = fields.map((field) => field.id === "field-1" ? { ...field, status: "archived", etag: '"field-etag-3"', revision: 3, can_delete: false, can_restore: true } : field);
      return jsonResponse(fields[0]);
    }
    if (path === "/api/contacts/custom-fields/field-1/restore" && method === "POST") {
      fields = fields.map((field) => field.id === "field-1" ? { ...field, status: "active", etag: '"field-etag-4"', revision: 4, can_delete: true, can_restore: false } : field);
      return jsonResponse(fields[0]);
    }
    if (path.endsWith("/custom-fields")) return jsonResponse(fields[0].status === "active" ? [{ id: "value-1", field_definition_id: "field-1", field_key: "account_tier", label: "Account tier", field_type: "text", value: "preferred" }] : []);
    if (path === "/api/contacts/interoperability") return jsonResponse({ formats: { csv: { import: true, export: true }, vcard: { import: true, export: true } }, providers: [{ id: "carddav", adapter: "not_installed", configured: false }], sync_claim: "No provider synchronization is active until a qualified adapter is installed and configured." });
    if (path.endsWith("/external-identities")) return jsonResponse([]);
    if (path === "/api/commands") return jsonResponse({ result: {} });
    return jsonResponse({ detail: `Unexpected request: ${path}` }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function importBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([path]) => path === "/api/contacts/import-csv").map(([, options]) => bodyOf(options));
}

function bodyOf(options?: RequestInit) {
  return JSON.parse(String(options?.body || "{}"));
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: vi.fn().mockResolvedValue(JSON.stringify(body)), blob: vi.fn().mockResolvedValue(new Blob()), headers: { get: vi.fn(() => null) } } as unknown as Response;
}

function blobResponse(body: string, headers: Record<string, string>) {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue(body), blob: vi.fn().mockResolvedValue(new Blob([body])), headers: { get: vi.fn((name: string) => headers[name] || null) } } as unknown as Response;
}
