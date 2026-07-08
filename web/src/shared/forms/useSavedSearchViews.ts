import { useEffect, useState } from "react";

import { readStorageJson, writeStorageJson } from "../storage";
import type { SavedSearchView } from "./SearchWorkspace.types";

export function useSavedSearchViews(storageKey: string) {
  const [savedViews, setSavedViews] = useState<SavedSearchView[]>(() => readSavedViews(storageKey));

  useEffect(() => {
    writeSavedViews(storageKey, savedViews);
  }, [savedViews, storageKey]);

  const upsertSavedView = (view: SavedSearchView) => {
    setSavedViews((current) => [view, ...current.filter((item) => item.name !== view.name)].slice(0, 8));
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews((current) => current.filter((item) => item.id !== viewId));
  };

  return { savedViews, upsertSavedView, deleteSavedView };
}

function readSavedViews(storageKey: string): SavedSearchView[] {
  const views = readStorageJson<SavedSearchView[]>("local", storageKey, [], isSavedSearchViewArray);
  return views.filter((view) => view.name.trim() && view.name !== "Working view");
}

function writeSavedViews(storageKey: string, views: SavedSearchView[]) {
  writeStorageJson("local", storageKey, views);
}

function isSavedSearchViewArray(value: unknown): value is SavedSearchView[] {
  return Array.isArray(value) && value.every((view) => {
    if (!view || typeof view !== "object") return false;
    const item = view as Partial<SavedSearchView>;
    return typeof item.id === "string" && typeof item.name === "string" && typeof item.query === "string";
  });
}
