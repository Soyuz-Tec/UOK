import { useEffect, useState } from "react";

import { getContactActivity, type ContactActivityRecord } from "./contactActivityApi";

export function useContactActivity({
  token,
  partyId,
  page,
  pageSize,
  refreshKey
}: {
  token: string;
  partyId: string;
  page: number;
  pageSize: number;
  refreshKey?: string | number;
}) {
  const [items, setItems] = useState<ContactActivityRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!token || !partyId) {
      setItems([]);
      setTotalCount(0);
      setError("");
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    void getContactActivity(token, partyId, pageSize, page * pageSize, controller.signal)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
      })
      .catch((cause) => {
        if (!active || controller.signal.aborted) return;
        setItems([]);
        setTotalCount(0);
        setError(cause instanceof Error ? cause.message : "Unable to load contact activity.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, pageSize, partyId, refreshKey, requestVersion, token]);

  return {
    error,
    items,
    loading,
    retry: () => setRequestVersion((value) => value + 1),
    totalCount
  };
}
