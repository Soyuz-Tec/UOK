import type { ContactGroupRecord, ContactRecord } from "../../web/src/contracts";

export const contact: ContactRecord = {
  id: "contact-1",
  party_type: "person",
  display_name: "Example Contact",
  status: "active",
  review_state: "ready",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "example@uok.test",
  phone: "+1 555 0100",
  address: "100 Example Street",
  organization_name: "Example Organization"
};

export const importedContact: ContactRecord = {
  id: "contact-2",
  party_type: "person",
  display_name: "imported.person@example.test",
  status: "active",
  review_state: "needs_review",
  visibility_scope: "tenant",
  source: "csv_import",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "imported.person@example.test"
};

export const businessContactWithoutCompany: ContactRecord = {
  id: "contact-5",
  party_type: "person",
  display_name: "Mina Supplier",
  status: "active",
  review_state: "needs_review",
  visibility_scope: "tenant",
  source: "gmail",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "mina@supplier.example",
  phone: "+1 555 0160"
};

export const duplicateContact: ContactRecord = {
  id: "contact-3",
  party_type: "person",
  display_name: "Example Contact",
  status: "active",
  review_state: "possible_duplicate",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "example@uok.test",
  phone: "+1 555 0111",
  duplicate_candidates: [{ id: "contact-1", display_name: "Example Contact", reason: "email" }]
};

export const organizationContact: ContactRecord = {
  id: "contact-4",
  party_type: "organization",
  display_name: "Avalon Bear Hill",
  status: "active",
  review_state: "ready",
  visibility_scope: "tenant",
  source: "contacts",
  sync_state: "ready",
  can_delete: true,
  can_restore: false,
  can_purge: true,
  attrs: {},
  email: "ops@avalon.example"
};

export const contactGroup: ContactGroupRecord = {
  id: "group-1",
  name: "Important contacts",
  description: "",
  kind: "manual",
  visibility_scope: "organization",
  status: "active",
  member_count: 1,
  active_member_count: 1
};
