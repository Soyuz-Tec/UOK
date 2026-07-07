export type Section = "overview" | "apps" | "contacts" | "evidence" | "architecture";
export type Appearance = "system" | "light" | "dark";
export type AuthMode = "signin" | "register";
export type ModuleAction = "install" | "uninstall" | "disable" | "enable" | "upgrade";
export type ContactsView = "split" | "table" | "cards";
export type ContactDetailPane = "overview" | "intelligence" | "activity" | "relationships";

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

export type ContactBusinessProfile = {
  profile_type?: string;
  summary?: string;
  tags?: string[];
  scores?: Record<string, number>;
  confidence?: string;
  risk_flags?: string[];
  updated_at?: string | null;
  source_count?: number;
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
  business_profile?: ContactBusinessProfile;
  notes?: Array<{ id: string; body: string; created_at: string }>;
  relationships?: Array<{ id: string; from_party_id: string; to_party_id: string; relationship_type: string }>;
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
