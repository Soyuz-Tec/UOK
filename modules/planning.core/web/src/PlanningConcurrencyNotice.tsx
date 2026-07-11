import { Check, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { CommandButton } from "@uok/shared/primitives";
import type { PlanningStaleRecovery } from "./planningConcurrencyState";

export function PlanningConcurrencyNotice({
  recovery,
  busy,
  onReapply,
  onKeepLatest,
  onReload,
}: {
  recovery: PlanningStaleRecovery;
  busy: string;
  onReapply: () => void;
  onKeepLatest: () => void;
  onReload: () => void;
}) {
  const noticeRef = useRef<HTMLElement>(null);

  useEffect(() => noticeRef.current?.focus(), [recovery.detail.current_revision, recovery.label]);

  const missingVersion = recovery.detail.code === "precondition_required";
  return (
    <section
      ref={noticeRef}
      className="planning-concurrency-notice"
      role="alert"
      aria-live="assertive"
      aria-label="Planning change needs review"
      tabIndex={-1}
    >
      <TriangleAlert size={20} aria-hidden="true" />
      <div className="planning-concurrency-copy">
        <strong>{missingVersion ? "Schedule version was unavailable" : "Schedule changed before your update"}</strong>
        <span>{recovery.detail.message}</span>
        <span>
          {recovery.reloadFailed
            ? "The latest schedule could not be loaded. Reload it before reapplying your change."
            : `Revision ${recovery.detail.current_revision} is loaded. Review it, then reapply ${recovery.label.toLowerCase()} or keep the latest version.`}
        </span>
      </div>
      <div className="planning-concurrency-actions">
        {recovery.reloadFailed ? (
          <CommandButton icon={RefreshCw} onClick={onReload} loading={busy === "recovery-reload"}>Reload latest</CommandButton>
        ) : null}
        <CommandButton icon={RotateCcw} onClick={onReapply} loading={busy === "reapply"} disabled={recovery.reloadFailed} primary>
          Reapply change
        </CommandButton>
        <CommandButton icon={Check} onClick={onKeepLatest} disabled={busy === "reapply" || busy === "recovery-reload"}>
          Keep latest
        </CommandButton>
      </div>
    </section>
  );
}
