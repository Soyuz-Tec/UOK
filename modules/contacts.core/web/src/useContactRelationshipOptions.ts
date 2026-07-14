import { useEffect, useState } from "react";

import { getContactRelationshipOptions, type ContactRelationshipOption } from "./contactRelationshipOptionsApi";

export function useContactRelationshipOptions(token: string, query: string, excludePartyId: string) {
  const [options, setOptions] = useState<ContactRelationshipOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!token || normalizedQuery.length < 2) {
      setOptions([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void getContactRelationshipOptions(token, normalizedQuery, excludePartyId, controller.signal)
        .then(setOptions)
        .catch((cause) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setError(cause instanceof Error ? cause.message : "Unable to search contacts.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [excludePartyId, normalizedQuery, token]);

  return { error, loading, options };
}
