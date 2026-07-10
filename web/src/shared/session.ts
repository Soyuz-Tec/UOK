import type { SessionUser } from "./types";
import { readStorageJson, readStorageString, removeStorageItem } from "./storage";

export const tokenKey = "uok_token";
export const userKey = "uok_user";
export const appearanceKey = "uok_appearance";
export const localeKey = "uok_locale";
export const contactsViewKey = "uok_contacts_view";
export const contactsGroupByKey = "uok_contacts_group_by";
export const sidebarCollapsedKey = "uok_sidebar_collapsed";

export function storedUser() {
  return readStorageJson<SessionUser | null>("local", userKey, null, isSessionUser);
}

export function storedToken() {
  const value = readStorageString("session", tokenKey);
  removeStorageItem("local", tokenKey);
  return value;
}

function isSessionUser(value: unknown): value is SessionUser | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<SessionUser>;
  return typeof user.username === "string" && typeof user.display_name === "string";
}
