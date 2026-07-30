import { useEffect, useState } from "react";

const compactContactsQuery = "(max-width: 980px)";

function currentCompactMatch() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(compactContactsQuery).matches;
}

export function useCompactContactsWorkspace() {
  const [compact, setCompact] = useState(currentCompactMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(compactContactsQuery);
    const update = (event: MediaQueryListEvent) => setCompact(event.matches);
    setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}
