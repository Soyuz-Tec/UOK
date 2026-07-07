import { useEffect, useState } from "react";

import { browserStorage } from "../storage";
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
  const storage = browserStorage("local");
  if (!storage) return [];

  try {
    const raw = storage.getItem(storageKey);
    const views = raw ? JSON.parse(raw) as SavedSearchView[] : [];
    return views.filter((view) => view.name.trim() && view.name !== "Working view");
  } catch {
    storage.removeItem(storageKey);
    return [];
  }
}

function writeSavedViews(storageKey: string, views: SavedSearchView[]) {
  const storage = browserStorage("local");
  if (!storage) return;

  try {
    storage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // Saved searches are a convenience layer; search itself must keep working.
  }
}
