export type Section = "overview" | "apps" | "contacts" | "evidence" | "architecture";
export type Appearance = "system" | "light" | "dark";
export type AuthMode = "signin" | "register";
export type ModuleAction = "install" | "uninstall" | "disable" | "enable" | "upgrade";
export type ContactsView = "split" | "table" | "cards" | "quality";
export type ContactGroupBy = "none" | "type" | "review_state" | "source" | "organization";
export type ContactDetailPane = "overview" | "intelligence" | "activity" | "relationships";
export type ContactSortBy = "display_name" | "updated_at" | "created_at" | "status" | "review_state" | "party_type" | "source";
export type ContactSortDir = "asc" | "desc";
export type ContactMergeField = "given_name" | "family_name" | "organization_name" | "email" | "phone" | "website" | "address" | "title";
export type ContactMergeFieldChoices = Partial<Record<ContactMergeField, "primary" | "duplicate">>;

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

export type ContactBusinessIntelligenceProfile = {
  profile_type: "person" | "organization" | "unknown";
  headline: string;
  summary: string;
  confidence: "unknown" | "low" | "medium" | "high" | "verified";
  readiness: "ready" | "needs_review" | "possible_duplicate" | "incomplete" | "archived" | "purged";
  signal_count: number;
  fact_count: number;
  note_count: number;
  relationship_count: number;
  group_count: number;
  business_domain_group_count: number;
  duplicate_candidate_count: number;
  primary_organization_name?: string;
  recent_note?: string;
  updated_at?: string | null;
  tags: string[];
  risk_flags: string[];
  group_names: string[];
  relationship_names: string[];
};

export type ContactGroupMembership = {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  visibility_scope: string;
  status?: string;
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
  created_at?: string;
  updated_at?: string | null;
  archived_at?: string | null;
  purged_at?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  given_name?: string;
  family_name?: string;
  organization_name?: string;
  title?: string;
  notes?: Array<{ id: string; body: string; created_at: string }>;
  business_intelligence_profile?: ContactBusinessIntelligenceProfile;
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
