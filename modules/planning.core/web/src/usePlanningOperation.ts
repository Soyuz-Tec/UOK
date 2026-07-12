import { useCallback, useRef, useState } from "react";

export function usePlanningOperation() {
  const [busy, setBusy] = useState("");
  const ownerRef = useRef<{ action: string; ticket: number } | null>(null);
  const sequenceRef = useRef(0);

  const start = useCallback((action: string) => {
    if (ownerRef.current) return false;
    const ticket = ++sequenceRef.current;
    ownerRef.current = { action, ticket };
    setBusy(action);
    return ticket;
  }, []);

  const finish = useCallback((ticket: number) => {
    if (ownerRef.current?.ticket !== ticket) return;
    ownerRef.current = null;
    setBusy("");
  }, []);

  const invalidate = useCallback(() => {
    ownerRef.current = null;
    setBusy("");
  }, []);

  const isCurrent = useCallback((ticket: number) => ownerRef.current?.ticket === ticket, []);

  return { busy, finish, invalidate, isCurrent, start };
}
