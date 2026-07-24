import { useEffect, useMemo } from "react";

import { browserStorage, removeStorageItem } from "@uok/shared/storage";

const STORAGE_PREFIX = "uok_intelligence_shipment_readiness_session_views";

export function useEphemeralSavedViewsKey(sessionToken: string) {
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${randomSuffix()}`,
    [sessionToken],
  );

  useEffect(() => {
    removeMatchingKeys("session", storageKey);
    removeMatchingKeys("local");
    return () => removeStorageItem("session", storageKey);
  }, [storageKey]);

  return storageKey;
}

function removeMatchingKeys(
  storageKind: "local" | "session",
  activeKey?: string,
) {
  const storage = browserStorage(storageKind);
  if (!storage) return;
  const staleKeys = Array.from(
    { length: storage.length },
    (_, index) => storage.key(index),
  ).filter((key): key is string => (
    Boolean(key?.startsWith(`${STORAGE_PREFIX}:`) && key !== activeKey)
  ));
  for (const key of staleKeys) removeStorageItem(storageKind, key);
}

function randomSuffix() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
