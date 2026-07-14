import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactGroupRecord, ContactRecord } from "@uok/shared/types";
import { contact, organizationContact, renderContactsWorkspace, resetContactsWorkspaceTest } from "./ContactsWorkspace.testUtils";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.dir = "ltr";
  resetContactsWorkspaceTest();
});

describe("Contacts Groups Manager", () => {
  it("moves group administration into Contacts tools and restores focus after the popup closes", async () => {
    installGroupsApiMock();
    renderContactsWorkspace("table", [contact, organizationContact]);

    expect(screen.queryByLabelText("Contact groups")).not.toBeInTheDocument();
    const searchTrigger = openSearchOptions();
    const tools = screen.getByRole("region", { name: "Contacts tools" });
    const managerTrigger = within(tools).getByRole("button", { name: "Groups manager" });
    fireEvent.click(managerTrigger);

    const dialog = await screen.findByRole("dialog", { name: "Groups manager" });
    expect(searchTrigger).toHaveAttribute("aria-expanded", "false");
    expect(within(dialog).getByRole("button", { name: "Move Groups manager" })).toBeInTheDocument();
    expect(await within(dialog).findByRole("button", { name: "New group" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close Groups manager" }));

    await waitFor(() => expect(searchTrigger).toHaveFocus());
  });

  it("filters manual, generated, empty, and archived groups and explains generated governance", async () => {
    installGroupsApiMock();
    renderContactsWorkspace("table");
    const dialog = await openGroupsManager();

    expect(await within(dialog).findByRole("button", { name: /Important contacts/ })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Group type"), { target: { value: "generated" } });
    expect(within(dialog).queryByRole("button", { name: /Important contacts/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Company: Example/ }));
    expect(within(dialog).getByText("Generated group - read-only")).toBeInTheDocument();
    expect(within(dialog).getByText(/reconciles this group from governed contact facts/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Archive group" })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Group type"), { target: { value: "all" } });
    fireEvent.click(within(dialog).getByLabelText("Empty groups only"));
    expect(within(dialog).getByRole("button", { name: /Follow up/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Important contacts/ })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText("Empty groups only"));
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "archived" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Former clients/ }));
    expect(within(dialog).getByRole("button", { name: "Restore group" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Restore this manual group before editing/i)).toBeInTheDocument();
  });

  it("creates, edits, archives, restores, and manages manual membership through governed routes", async () => {
    const api = installGroupsApiMock();
    const onRefreshContacts = vi.fn().mockResolvedValue(undefined);
    renderContactsWorkspace("table", [contact, organizationContact], { onRefreshContacts });
    const dialog = await openGroupsManager();

    fireEvent.click(await within(dialog).findByRole("button", { name: /Important contacts/ }));
    await within(dialog).findByText("Example Contact");
    fireEvent.change(within(dialog).getByLabelText("Group name"), { target: { value: "Priority contacts" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups/group-manual", expect.objectContaining({ method: "PATCH" })));

    fireEvent.change(within(dialog).getByLabelText("Find a contact"), { target: { value: "Avalon" } });
    await waitFor(() => expect(within(dialog).getByRole("option", { name: "Avalon Bear Hill" })).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText("Contact"), { target: { value: organizationContact.id } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add member" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups/group-manual/members", expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove Example Contact" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups/group-manual/members/contact-1", expect.objectContaining({ method: "DELETE" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "Archive group" }));
    let confirmation = within(dialog).getByRole("group", { name: "Confirm group archive" });
    expect(confirmation).toHaveFocus();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Archive group" })).toHaveFocus());
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive group" }));
    confirmation = within(dialog).getByRole("group", { name: "Confirm group archive" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Archive group" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups/group-manual", expect.objectContaining({ method: "DELETE" })));

    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "archived" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore group" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups/group-manual/restore", expect.objectContaining({ method: "POST" })));

    fireEvent.click(within(dialog).getByRole("button", { name: "New group" }));
    fireEvent.change(within(dialog).getByLabelText("Group name"), { target: { value: "Vendors" } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Reviewed vendors" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create group" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/contacts/groups", expect.objectContaining({ method: "POST" })));
    expect(onRefreshContacts).toHaveBeenCalled();
  });

  it("keeps management discoverable but disabled for read-only roles and surfaces server errors", async () => {
    installGroupsApiMock({ failPatch: true });
    renderContactsWorkspace("table", [contact], { currentUserRole: "viewer" });
    let dialog = await openGroupsManager();

    expect(await within(dialog).findByRole("button", { name: "New group" })).toBeDisabled();
    expect(within(dialog).getByText(/can review groups and members, but it cannot change them/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Group name")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Business domains" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close Groups manager" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Groups manager" })).not.toBeInTheDocument());
    resetContactsWorkspaceTest();
    vi.unstubAllGlobals();
    installGroupsApiMock({ failPatch: true });
    renderContactsWorkspace("table", [contact], { currentUserRole: "platform_admin" });
    dialog = await openGroupsManager();
    fireEvent.change(await within(dialog).findByLabelText("Group name"), { target: { value: "Conflicting name" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("contact group name already exists");
  });

  it("uses the shared Arabic catalog in an RTL workspace", async () => {
    installGroupsApiMock();
    document.documentElement.dir = "rtl";
    renderContactsWorkspace("table", [contact], {}, "ar");

    fireEvent.click(screen.getByRole("button", { name: /^خيارات البحث:/ }));
    fireEvent.click(screen.getByRole("button", { name: "مدير المجموعات" }));
    const dialog = await screen.findByRole("dialog", { name: "مدير المجموعات" });
    expect(await within(dialog).findByRole("button", { name: "مجموعة جديدة" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("نوع المجموعة")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});

function openSearchOptions() {
  const trigger = screen.getByRole("button", { name: /^Search options:/ });
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return trigger;
}

async function openGroupsManager() {
  openSearchOptions();
  fireEvent.click(screen.getByRole("button", { name: "Groups manager" }));
  return screen.findByRole("dialog", { name: "Groups manager" });
}

function installGroupsApiMock({ failPatch = false }: { failPatch?: boolean } = {}) {
  let groups: ContactGroupRecord[] = [
    { id: "group-manual", name: "Important contacts", description: "Priority working set", kind: "manual", visibility_scope: "organization", status: "active", member_count: 1, active_member_count: 1 },
    { id: "group-generated", name: "Company: Example", description: "Generated from organization facts", kind: "smart_rule", visibility_scope: "organization", status: "active", member_count: 2, active_member_count: 2 },
    { id: "group-empty", name: "Follow up", description: "", kind: "manual", visibility_scope: "organization", status: "active", member_count: 0, active_member_count: 0 },
    { id: "group-archived", name: "Former clients", description: "", kind: "manual", visibility_scope: "organization", status: "archived", member_count: 3, active_member_count: 3 }
  ];
  let members: ContactRecord[] = [contact];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const path = String(input);
    const method = options.method || "GET";
    if (path === "/api/contacts/saved-views" && method === "GET") return response([]);
    if (path.startsWith("/api/contacts/groups?")) return response(groups);
    if (path === "/api/contacts/groups" && method === "POST") {
      const payload = JSON.parse(String(options.body));
      const created = { id: "group-new", name: payload.name, description: payload.description || "", kind: "manual", visibility_scope: "organization", status: "active", member_count: 0, active_member_count: 0 };
      groups = [...groups, created];
      return response(created);
    }
    if (path.endsWith("/restore") && method === "POST") {
      const id = path.split("/").at(-2)!;
      groups = groups.map((group) => group.id === id ? { ...group, status: "active" } : group);
      return response(groups.find((group) => group.id === id));
    }
    if (path.includes("/members/") && method === "DELETE") {
      const id = path.split("/").at(-1)!;
      members = members.filter((member) => member.id !== id);
      return response({ removed_count: 1 });
    }
    if (path.endsWith("/members") && method === "POST") {
      const payload = JSON.parse(String(options.body));
      if (payload.party_ids.includes(organizationContact.id)) members = [...members, organizationContact];
      return response({ added_count: 1 });
    }
    if (path.startsWith("/api/contacts/groups/") && method === "PATCH") {
      if (failPatch) return response({ detail: { error: "contact group name already exists" } }, 400);
      const id = path.split("/").at(-1)!;
      const payload = JSON.parse(String(options.body));
      groups = groups.map((group) => group.id === id ? { ...group, ...payload } : group);
      return response(groups.find((group) => group.id === id));
    }
    if (path.startsWith("/api/contacts/groups/") && method === "DELETE") {
      const id = path.split("/").at(-1)!;
      groups = groups.map((group) => group.id === id ? { ...group, status: "archived" } : group);
      return response(groups.find((group) => group.id === id));
    }
    if (path.startsWith("/api/contacts?")) {
      const params = new URLSearchParams(path.split("?")[1]);
      if (params.get("group_id")) return response(members);
      const query = params.get("query")?.toLocaleLowerCase() || "";
      return response([contact, organizationContact].filter((row) => !query || row.display_name.toLocaleLowerCase().includes(query)));
    }
    if (path === "/api/commands") return response({ status: "completed", result: {} });
    return response({ detail: "Unexpected request" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}
