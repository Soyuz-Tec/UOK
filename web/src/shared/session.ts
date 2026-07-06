import type { SessionUser } from "./types";

export const tokenKey = "uok_token";
export const userKey = "uok_user";
export const appearanceKey = "uok_appearance";
export const contactsViewKey = "uok_contacts_view";
export const sidebarCollapsedKey = "uok_sidebar_collapsed";

export function storedUser() {
  try {
    const value = localStorage.getItem(userKey);
    return value ? JSON.parse(value) as SessionUser : null;
  } catch {
    localStorage.removeItem(userKey);
    return null;
  }
}

export function storedToken() {
  const value = sessionStorage.getItem(tokenKey) || "";
  localStorage.removeItem(tokenKey);
  return value;
}
