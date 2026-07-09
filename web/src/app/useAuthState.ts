import { useCallback, useState } from "react";

import { storedToken, storedUser, tokenKey, userKey } from "../shared/session";
import { removeStorageItem } from "../shared/storage";
import type { AuthMode, SessionUser } from "../shared/types";

export function useAuthState() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [token, setToken] = useState(() => storedToken());
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => storedUser());
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");

  const clearAuthState = useCallback(() => {
    removeStorageItem("local", tokenKey);
    removeStorageItem("session", tokenKey);
    removeStorageItem("local", userKey);
    setToken("");
    setCurrentUser(null);
    setPassword("");
    setRegisterPassword("");
    setAuthMode("signin");
  }, []);

  return {
    authMode,
    clearAuthState,
    currentUser,
    loginError,
    password,
    registerEmail,
    registerError,
    registerName,
    registerPassword,
    setAuthMode,
    setCurrentUser,
    setLoginError,
    setPassword,
    setRegisterEmail,
    setRegisterError,
    setRegisterName,
    setRegisterPassword,
    setToken,
    setUsername,
    token,
    username
  };
}

export type AuthState = ReturnType<typeof useAuthState>;
