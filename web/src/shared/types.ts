import type {
  HostAppearance,
  HostModuleAction,
  HostModuleStatus,
} from "../contracts/moduleSurface";
import type { GeneratedModuleSection } from "../generated/moduleSections";

export type CoreSection = "overview" | "evidence" | "architecture";
export type Section = CoreSection | GeneratedModuleSection;
export type Appearance = HostAppearance;
export type UokLocale = "en-US" | "ar";
export type AuthMode = "signin" | "register";
export type ModuleAction = HostModuleAction;
export type ModuleStatus = HostModuleStatus;

export type SessionUser = {
  username: string;
  display_name: string;
  email?: string | null;
  role: string;
};

export type Dashboard = { counts: Record<string, number> };

export type QualityReport = {
  ok?: boolean;
  checks?: Record<string, boolean | undefined>;
};
