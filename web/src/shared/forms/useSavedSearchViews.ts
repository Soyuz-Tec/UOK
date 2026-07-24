import { useEffect, useState } from "react";

import { readStorageJson, writeStorageJson } from "../storage";
import type { SavedSearchView } from "./SearchWorkspace.types";

export type SavedSearchStorageKind = "local" | "session";

export function useSavedSearchViews(
  storageKey: string,
  storageKind: SavedSearchStorageKind = "local",
) {
  const [savedViews, setSavedViews] = useState<SavedSearchView[]>(
    () => readSavedViews(storageKind, storageKey),
  );

  useEffect(() => {
    writeSavedViews(storageKind, storageKey, savedViews);
  }, [savedViews, storageKey, storageKind]);

  const upsertSavedView = (view: SavedSearchView) => {
    const normalizedName = view.name.trim().toLocaleLowerCase();
    setSavedViews((current) => [view, ...current.filter((item) => item.name.trim().toLocaleLowerCase() !== normalizedName)].slice(0, 8));
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews((current) => current.filter((item) => item.id !== viewId));
  };

  return { savedViews, upsertSavedView, deleteSavedView };
}

function readSavedViews(
  storageKind: SavedSearchStorageKind,
  storageKey: string,
): SavedSearchView[] {
  const views = readStorageJson<SavedSearchView[]>(
    storageKind,
    storageKey,
    [],
    isSavedSearchViewArray,
  );
  return views.filter((view) => view.name.trim() && view.name !== "Working view");
}

function writeSavedViews(
  storageKind: SavedSearchStorageKind,
  storageKey: string,
  views: SavedSearchView[],
) {
  writeStorageJson(storageKind, storageKey, views);
}

function isSavedSearchViewArray(value: unknown): value is SavedSearchView[] {
  return Array.isArray(value) && value.every((view) => {
    if (!view || typeof view !== "object") return false;
    const item = view as Partial<SavedSearchView>;
    return typeof item.id === "string" && typeof item.name === "string" && typeof item.query === "string";
  });
}
