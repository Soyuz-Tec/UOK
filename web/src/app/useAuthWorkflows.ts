import { useCallback, type FormEvent } from "react";

import type { AuthState } from "./useAuthState";
import type { WorkbenchData } from "./useWorkbenchData";
import { apiErrorMessage, validEmail } from "../shared/format";
import { tokenKey, userKey } from "../shared/session";
import { removeStorageItem, writeStorageJson, writeStorageString } from "../shared/storage";
import type { SessionUser } from "../shared/types";

export function useAuthWorkflows(auth: AuthState, data: WorkbenchData) {
  const clearSession = useCallback((message = "Signed out.") => {
    auth.clearAuthState();
    data.clearData(message);
  }, [auth.clearAuthState, data.clearData]);

  async function login(event?: FormEvent) {
    event?.preventDefault();
    try {
      data.setBusyAction("login");
      auth.setLoginError("");
      const response = await data.api<{ access_token: string; user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: auth.username.trim(), password: auth.password })
      });
      writeStorageString("session", tokenKey, response.access_token);
      removeStorageItem("local", tokenKey);
      writeStorageJson("local", userKey, response.user);
      auth.setToken(response.access_token);
      auth.setCurrentUser(response.user);
      auth.setPassword("");
      data.setOut(response.user);
      await data.refresh(response.access_token);
    } catch (error) {
      auth.setLoginError("Invalid username or password.");
      data.setOut(error);
    } finally {
      data.setBusyAction("");
    }
  }

  async function register(event?: FormEvent) {
    event?.preventDefault();
    const displayName = auth.registerName.trim();
    const email = auth.registerEmail.trim().toLowerCase();
    if (displayName.length < 2) {
      auth.setRegisterError("Enter your name.");
      return;
    }
    if (!validEmail(email)) {
      auth.setRegisterError("Enter a valid email address.");
      return;
    }
    if (auth.registerPassword.length < 8) {
      auth.setRegisterError("Use a password with at least 8 characters.");
      return;
    }
    try {
      data.setBusyAction("register");
      auth.setRegisterError("");
      const response = await data.api<{ access_token: string; user: SessionUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName, email, password: auth.registerPassword })
      });
      writeStorageString("session", tokenKey, response.access_token);
      removeStorageItem("local", tokenKey);
      writeStorageJson("local", userKey, response.user);
      auth.setToken(response.access_token);
      auth.setCurrentUser(response.user);
      auth.setUsername(email);
      auth.setPassword("");
      auth.setRegisterPassword("");
      data.setOut(response.user);
      await data.refresh(response.access_token);
    } catch (error) {
      auth.setRegisterError(apiErrorMessage(error, "Registration failed."));
      data.setOut(error);
    } finally {
      data.setBusyAction("");
    }
  }

  return { clearSession, login, register };
}
