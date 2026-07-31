import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { storedToken, storedUser, tokenKey, userKey } from "../shared/session";
import {
  removeStorageItem,
  writeStorageJson,
  writeStorageString
} from "../shared/storage";
import type { AuthMode, SessionUser } from "../shared/types";

type AuthSessionState = {
  token: string;
  currentUser: SessionUser | null;
  generation: number;
};

export function useAuthState() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [sessionState, setSessionState] = useState<AuthSessionState>(() => ({
    token: storedToken(),
    currentUser: storedUser(),
    generation: 0
  }));
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  const advanceGeneration = useCallback(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    if (mountedRef.current) {
      setSessionState((current) => ({ ...current, generation }));
    }
    return generation;
  }, []);

  const isSessionGenerationCurrent = useCallback((generation: number) => (
    mountedRef.current && generationRef.current === generation
  ), []);

  const beginAuthAttempt = useCallback(() => advanceGeneration(), [advanceGeneration]);

  const acceptAuthSession = useCallback((
    attemptGeneration: number,
    token: string,
    currentUser: SessionUser
  ) => {
    if (!isSessionGenerationCurrent(attemptGeneration)) return null;
    const generation = advanceGeneration();
    writeStorageString("session", tokenKey, token);
    removeStorageItem("local", tokenKey);
    writeStorageJson("local", userKey, currentUser);
    if (mountedRef.current) {
      setSessionState({ token, currentUser, generation });
    }
    return generation;
  }, [advanceGeneration, isSessionGenerationCurrent]);

  const clearAuthState = useCallback((expectedGeneration?: number) => {
    if (
      !mountedRef.current ||
      (expectedGeneration !== undefined && !isSessionGenerationCurrent(expectedGeneration))
    ) {
      return null;
    }
    const generation = advanceGeneration();
    removeStorageItem("local", tokenKey);
    removeStorageItem("session", tokenKey);
    removeStorageItem("local", userKey);
    if (mountedRef.current) {
      setSessionState({ token: "", currentUser: null, generation });
      setPassword("");
      setRegisterPassword("");
      setAuthMode("signin");
    }
    return generation;
  }, [advanceGeneration, isSessionGenerationCurrent]);

  useEffect(() => () => {
    mountedRef.current = false;
    generationRef.current += 1;
  }, []);

  const session = useMemo(() => {
    const { generation, token } = sessionState;
    return {
      token,
      generation,
      onUnauthorized: () => clearAuthState(generation)
    };
  }, [clearAuthState, sessionState]);

  return {
    acceptAuthSession,
    authMode,
    beginAuthAttempt,
    clearAuthState,
    currentUser: sessionState.currentUser,
    isSessionGenerationCurrent,
    loginError,
    password,
    registerEmail,
    registerError,
    registerName,
    registerPassword,
    session,
    setAuthMode,
    setLoginError,
    setPassword,
    setRegisterEmail,
    setRegisterError,
    setRegisterName,
    setRegisterPassword,
    setUsername,
    token: sessionState.token,
    username
  };
}

export type AuthState = ReturnType<typeof useAuthState>;
