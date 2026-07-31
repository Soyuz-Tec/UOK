import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadCommunicationCapabilities,
  loadCommunicationThread,
  loadCommunicationThreads,
} from "./communicationsApi";
import type { CommunicationCapabilities, CommunicationThread } from "./types";

const readOnlyCapabilities: CommunicationCapabilities = {
  read: false,
  create: false,
  delete: false,
  restore: false,
};

export function useCommunicationThreadCatalog({
  token,
  operational,
  requestedThreadId,
}: {
  token: string;
  operational: boolean;
  requestedThreadId: string;
}) {
  const [dataToken, setDataToken] = useState(token);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [selectedId, setSelectedId] = useState(requestedThreadId);
  const [requestedThread, setRequestedThread] = useState<CommunicationThread | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [capabilities, setCapabilities] = useState(readOnlyCapabilities);
  const [status, setStatus] = useState("K Connect ready.");
  const activeOperation = useRef<"refresh" | "create" | "delete" | "restore" | "">("");
  const refreshRequest = useRef(0);
  const operationSession = `${token}\u0000${operational ? "1" : "0"}`;
  const refreshSession = `${operationSession}\u0000${requestedThreadId}`;
  const operationSessionRef = useRef({ key: operationSession, generation: 0 });
  const refreshSessionRef = useRef({ key: refreshSession, generation: 0 });
  const previousTokenRef = useRef(token);
  if (operationSessionRef.current.key !== operationSession) {
    operationSessionRef.current = {
      key: operationSession,
      generation: operationSessionRef.current.generation + 1,
    };
  }
  if (refreshSessionRef.current.key !== refreshSession) {
    refreshSessionRef.current = {
      key: refreshSession,
      generation: refreshSessionRef.current.generation + 1,
    };
  }
  const refreshGeneration = refreshSessionRef.current.generation;
  const sessionMatches = dataToken === token;
  const authorizedThreads = useMemo(
    () => sessionMatches ? threads : [],
    [sessionMatches, threads],
  );
  const authorizedRequestedThread = sessionMatches ? requestedThread : null;
  const authorizedCapabilities = sessionMatches ? capabilities : readOnlyCapabilities;
  const captureSession = useCallback(() => {
    const generation = operationSessionRef.current.generation;
    return () => operationSessionRef.current.generation === generation;
  }, []);

  const refresh = useCallback(async (supersede = false) => {
    if (activeOperation.current && !(supersede && activeOperation.current === "refresh")) return;
    const request = ++refreshRequest.current;
    const requestGeneration = refreshGeneration;
    const isCurrent = () => (
      refreshRequest.current === request
      && refreshSessionRef.current.generation === requestGeneration
    );
    activeOperation.current = "refresh";
    setRefreshing(true);
    try {
      const [nextCapabilities, rows] = await Promise.all([
        loadCommunicationCapabilities(token).catch(() => readOnlyCapabilities),
        loadCommunicationThreads(token, "all"),
      ]);
      if (!isCurrent()) return;
      setDataToken(token);
      setCapabilities(nextCapabilities);
      setThreads(rows);
      setRequestedThread(null);
      if (requestedThreadId) {
        const exact = rows.find((row) => row.id === requestedThreadId)
          || await loadCommunicationThread(token, requestedThreadId);
        if (!isCurrent()) return;
        setRequestedThread(exact);
        setSelectedId(exact.id);
      } else {
        setSelectedId((current) => (
          rows.some((row) => row.id === current) ? current : rows[0]?.id || ""
        ));
      }
      setStatus(`${rows.length} authorized thread(s) loaded.`);
    } catch (error) {
      if (isCurrent()) {
        setDataToken(token);
        setStatus(error instanceof Error ? error.message : "K Connect refresh failed.");
      }
    } finally {
      if (isCurrent()) {
        activeOperation.current = "";
        setRefreshing(false);
      }
    }
  }, [refreshGeneration, requestedThreadId, token]);

  useEffect(() => {
    if (previousTokenRef.current === token) return;
    previousTokenRef.current = token;
    activeOperation.current = "";
    setDataToken(token);
    setCapabilities(readOnlyCapabilities);
    setThreads([]);
    setRequestedThread(null);
    setSelectedId("");
    setStatus("K Connect ready.");
  }, [token]);

  useEffect(() => {
    if (!token || !operational) {
      refreshRequest.current += 1;
      activeOperation.current = "";
      setDataToken(token);
      setCapabilities(readOnlyCapabilities);
      setThreads([]);
      setRequestedThread(null);
      setSelectedId("");
      setStatus("K Connect ready.");
      setRefreshing(false);
      return;
    }
    void refresh(true);
    return () => {
      refreshRequest.current += 1;
      if (activeOperation.current === "refresh") activeOperation.current = "";
    };
  }, [operational, refresh, token]);

  return {
    activeOperation,
    authorizedCapabilities,
    authorizedRequestedThread,
    authorizedThreads,
    captureSession,
    refresh,
    refreshing,
    selectedId,
    sessionMatches,
    setRequestedThread,
    setSelectedId,
    setStatus,
    setThreads,
    status,
  };
}
