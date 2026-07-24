import { useCallback, useEffect, useState } from "react";

import type { SavedSearchView } from "@uok/shared/forms";

type SavedViewRow = { id: string; name: string; query?: unknown; can_edit?: boolean };

export function useContactSavedViews(token: string) {
  const [savedViews, setSavedViews] = useState<SavedSearchView[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setSavedViews([]);
      setError("");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/contacts/saved-views", { headers: authHeaders(token) });
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(apiError(body));
      setSavedViews((body as SavedViewRow[]).flatMap(savedViewFromRow));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load saved views.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (view: SavedSearchView) => {
    setPendingAction("save");
    try {
      const response = await fetch("/api/contacts/saved-views", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: view.name,
          visibility_scope: "personal",
          is_pinned: false,
          query: {
            query: view.query,
            filters: view.filters,
            groupBy: view.groupBy,
            ...(view.sortBy ? { sortBy: view.sortBy } : {}),
            ...(view.sortDir ? { sortDir: view.sortDir } : {})
          }
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body));
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this view.");
      return false;
    } finally {
      setPendingAction("");
    }
  }, [load, token]);

  const remove = useCallback(async (viewId: string) => {
    setPendingAction(`delete:${viewId}`);
    try {
      const response = await fetch(`/api/contacts/saved-views/${encodeURIComponent(viewId)}`, {
        method: "DELETE",
        headers: authHeaders(token)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body));
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this view.");
      return false;
    } finally {
      setPendingAction("");
    }
  }, [load, token]);

  return { error, loading, pendingAction, reload: load, remove, save, savedViews };
}

function savedViewFromRow(row: SavedViewRow): SavedSearchView[] {
  if (!row.query || typeof row.query !== "object") return [];
  const query = row.query as Partial<SavedSearchView>;
  if (typeof query.query !== "string" || !query.filters || typeof query.filters !== "object" || typeof query.groupBy !== "string") return [];
  return [{
    id: row.id,
    name: row.name,
    query: query.query,
    filters: query.filters as Record<string, string>,
    groupBy: query.groupBy,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    locked: row.can_edit === false
  }];
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function apiError(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "error" in detail && typeof (detail as { error?: unknown }).error === "string") {
      return (detail as { error: string }).error;
    }
  }
  return "Contacts saved-view request failed.";
}
