import { useCallback, type FormEvent } from "react";

import type { AuthState } from "./useAuthState";
import type { WorkbenchData } from "./useWorkbenchData";
import { apiErrorMessage, validEmail } from "../shared/format";
import type { SessionUser } from "../shared/types";

export function useAuthWorkflows(auth: AuthState, data: WorkbenchData) {
  const { clearAuthState } = auth;
  const { clearData } = data;
  const clearSession = useCallback((
    message = "Signed out.",
    expectedGeneration?: number
  ) => {
    const generation = clearAuthState(expectedGeneration);
    if (generation === null) return false;
    clearData(message, generation);
    return true;
  }, [clearAuthState, clearData]);

  async function login(event?: FormEvent) {
    event?.preventDefault();
    const attemptGeneration = auth.beginAuthAttempt();
    let currentGeneration = attemptGeneration;
    const busyKey = "login";
    try {
      data.setBusyAction(busyKey, attemptGeneration);
      auth.setLoginError("");
      const response = await data.api<{ access_token: string; user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: auth.username.trim(), password: auth.password })
      });
      if (!auth.isSessionGenerationCurrent(attemptGeneration)) return;
      const acceptedGeneration = auth.acceptAuthSession(
        attemptGeneration,
        response.access_token,
        response.user
      );
      if (acceptedGeneration === null) return;
      currentGeneration = acceptedGeneration;
      auth.setPassword("");
      data.setOut(response.user, acceptedGeneration);
      // The session-generation effect owns the one authoritative host refresh.
    } catch (error) {
      if (!auth.isSessionGenerationCurrent(attemptGeneration)) return;
      auth.setLoginError("Invalid username or password.");
      data.setOut(error, attemptGeneration);
    } finally {
      if (auth.isSessionGenerationCurrent(currentGeneration)) {
        data.clearBusyAction(busyKey, currentGeneration);
      }
    }
  }

  async function register(event?: FormEvent) {
    event?.preventDefault();
    const attemptGeneration = auth.beginAuthAttempt();
    let currentGeneration = attemptGeneration;
    const busyKey = "register";
    const displayName = auth.registerName.trim();
    const email = auth.registerEmail.trim().toLowerCase();
    if (displayName.length < 2) {
      if (auth.isSessionGenerationCurrent(attemptGeneration)) {
        auth.setRegisterError("Enter your name.");
      }
      return;
    }
    if (!validEmail(email)) {
      if (auth.isSessionGenerationCurrent(attemptGeneration)) {
        auth.setRegisterError("Enter a valid email address.");
      }
      return;
    }
    if (auth.registerPassword.length < 8) {
      if (auth.isSessionGenerationCurrent(attemptGeneration)) {
        auth.setRegisterError("Use a password with at least 8 characters.");
      }
      return;
    }
    try {
      data.setBusyAction(busyKey, attemptGeneration);
      auth.setRegisterError("");
      const response = await data.api<{ access_token: string; user: SessionUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName, email, password: auth.registerPassword })
      });
      if (!auth.isSessionGenerationCurrent(attemptGeneration)) return;
      const acceptedGeneration = auth.acceptAuthSession(
        attemptGeneration,
        response.access_token,
        response.user
      );
      if (acceptedGeneration === null) return;
      currentGeneration = acceptedGeneration;
      auth.setUsername(email);
      auth.setPassword("");
      auth.setRegisterPassword("");
      data.setOut(response.user, acceptedGeneration);
      // The session-generation effect owns the one authoritative host refresh.
    } catch (error) {
      if (!auth.isSessionGenerationCurrent(attemptGeneration)) return;
      auth.setRegisterError(apiErrorMessage(error, "Registration failed."));
      data.setOut(error, attemptGeneration);
    } finally {
      if (auth.isSessionGenerationCurrent(currentGeneration)) {
        data.clearBusyAction(busyKey, currentGeneration);
      }
    }
  }

  return { clearSession, login, register };
}
