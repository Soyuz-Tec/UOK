export type Section = "overview" | "apps" | "contacts" | "evidence" | "architecture";
export type Appearance = "system" | "light" | "dark";
export type AuthMode = "signin" | "register";
export type ModuleAction = "install" | "uninstall" | "disable" | "enable" | "upgrade";
export type ContactsView = "split" | "table" | "cards" | "quality";
export type ContactGroupBy = "none" | "type" | "review_state" | "source" | "organization";
export type ContactDetailPane = "overview" | "activity" | "relationships";
export type ContactSortBy = "display_name" | "updated_at" | "created_at" | "status" | "review_state" | "party_type" | "source";
export type ContactSortDir = "asc" | "desc";

export type ContactGroupRecord = {
  id: string;
  name: string;
  description?: string;
  kind: string;
  visibility_scope: string;
  owner_user_id?: string | null;
  team_id?: string | null;
  status: string;
  member_count: number;
  active_member_count?: number;
};

export type ContactGroupMembership = {
  id: string;
  name: string;
  description?: string;
  visibility_scope: string;
  member_id: string;
  created_at: string;
};

export type SessionUser = {
  username: string;
  display_name: string;
  email?: string | null;
  role: string;
};

export type Dashboard = { counts: Record<string, number> };

export type ModuleStatus = {
  name: string;
  status: string;
  version: string;
  kind: string;
  installable: boolean;
  uninstallable: boolean;
  updatable: boolean;
  maintainable: boolean;
  required: boolean;
  dependencies: string[];
  dependents: string[];
};

export type QualityReport = {
  ok?: boolean;
  checks?: Record<string, boolean | undefined>;
};

export type ContactAttrs = {
  given_name?: string;
  family_name?: string;
  organization_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  title?: string;
  duplicate_candidates?: Array<{ id: string; display_name: string; reason: string }>;
};

export type ContactRecord = {
  id: string;
  contact_id?: string;
  party_type: "person" | "organization" | string;
  display_name: string;
  status: string;
  review_state: string;
  owner_user_id?: string | null;
  team_id?: string | null;
  visibility_scope: string;
  source: string;
  sync_state: string;
  attrs: ContactAttrs;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  given_name?: string;
  family_name?: string;
  organization_name?: string;
  title?: string;
  notes?: Array<{ id: string; body: string; created_at: string }>;
  relationships?: Array<{
    id: string;
    from_party_id: string;
    to_party_id: string;
    relationship_type: string;
    direction?: "outbound" | "inbound" | string;
    related_party_id?: string;
    related_party_name?: string;
    related_party_type?: string;
    related_party_email?: string;
    related_party_phone?: string;
  }>;
  groups?: ContactGroupMembership[];
  duplicate_candidates?: Array<{ id: string; display_name: string; reason: string }>;
};

export type ContactDraft = {
  party_type: "person" | "organization";
  display_name: string;
  given_name: string;
  family_name: string;
  organization_name: string;
  company_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  title: string;
  note: string;
  team_id: string;
};

export const emptyDraft: ContactDraft = {
  party_type: "person",
  display_name: "",
  given_name: "",
  family_name: "",
  organization_name: "",
  company_name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  title: "",
  note: "",
  team_id: ""
};
