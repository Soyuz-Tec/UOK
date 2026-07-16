import { RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { CommunicationThread } from "./types";

export type CommunicationFocusCommand = "delete" | "restore" | "";

export function CommunicationThreadDetail({
  thread,
  canDelete,
  canRestore,
  busyAction,
  focusCommand,
  onDelete,
  onRestore,
  onFocusRecovered,
}: {
  thread: CommunicationThread | null;
  canDelete: boolean;
  canRestore: boolean;
  busyAction: "delete" | "restore" | "";
  focusCommand: CommunicationFocusCommand;
  onDelete: (thread: CommunicationThread) => Promise<void>;
  onRestore: (thread: CommunicationThread) => Promise<void>;
  onFocusRecovered: () => void;
}) {
  const { t } = useUokLocalization();
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusCommand || !thread) return undefined;
    let targetFrame = 0;
    const popupFrame = window.requestAnimationFrame(() => {
      targetFrame = window.requestAnimationFrame(() => {
        const target = detailRef.current?.querySelector<HTMLElement>(`[data-command="${focusCommand}-thread"]`);
        const button = target instanceof HTMLButtonElement ? target : target?.querySelector<HTMLButtonElement>("button");
        button?.focus();
        onFocusRecovered();
      });
    });
    return () => {
      window.cancelAnimationFrame(popupFrame);
      if (targetFrame) window.cancelAnimationFrame(targetFrame);
    };
  }, [focusCommand, onFocusRecovered, thread]);

  if (!thread) return <EmptyState text={t("communications.selectThread", "Select a communication thread.")} />;

  const restoreStatus = thread.restore_status || (thread.status === "closed" ? "closed" : "open");
  const retainedImpact = t(
    "communications.deleteImpact",
    "from active use? The thread identity and audit history remain, linked Planning records are not deleted, and the thread can be restored from Archived.",
  );

  return (
    <article ref={detailRef} className="communications-thread-detail" data-thread-id={thread.id}>
      <h2>{thread.title}</h2>
      <dl>
        <div><dt>{t("communications.threadId", "Thread ID")}</dt><dd>{thread.id}</dd></div>
        <div><dt>{t("communications.context", "Context")}</dt><dd>{thread.context_type}{thread.context_id ? ` · ${thread.context_id}` : ""}</dd></div>
        <div><dt>{t("communications.lastActivity", "Last activity")}</dt><dd>{new Date(thread.updated_at).toLocaleString()}</dd></div>
        {thread.status === "archived" ? <div><dt>{t("communications.restoreAs", "Restore as")}</dt><dd>{restoreStatus}</dd></div> : null}
      </dl>
      <p>{t("communications.capabilityNote", "This governed thread is ready for linked operational conversation. Message exchange is a later K Connect capability.")}</p>
      <div className="communications-thread-actions">
        {thread.status === "archived" && canRestore ? (
          <CommandButton
            icon={RotateCcw}
            data-command="restore-thread"
            primary
            onClick={() => void onRestore(thread)}
            disabled={Boolean(busyAction)}
            loading={busyAction === "restore"}
          >
            {t("communications.restore", "Restore thread")}
          </CommandButton>
        ) : null}
        {thread.status !== "archived" && canDelete ? (
          <span data-command="delete-thread">
            <ConfirmCommandButton
              key={thread.etag}
              icon={Trash2}
              message={`${t("communications.deletePrefix", "Delete")} “${thread.title}” ${retainedImpact} ${t("communications.restoreState", "Restore will return it to")} ${restoreStatus}.`}
              dialogLabel={t("communications.deleteConfirm", "Confirm thread deletion")}
              title={`${t("communications.deletePrefix", "Delete")} “${thread.title}”?`}
              confirmLabel={t("communications.delete", "Delete thread")}
              onConfirm={() => onDelete(thread)}
              disabled={Boolean(busyAction)}
              loading={busyAction === "delete"}
              destructive
            >
              {t("communications.delete", "Delete thread")}
            </ConfirmCommandButton>
          </span>
        ) : null}
        {!canDelete && !canRestore ? (
          <p className="communications-readonly" role="note"><ShieldCheck size={16} aria-hidden="true" /> {t("communications.reviewOnly", "Review only")}</p>
        ) : null}
      </div>
    </article>
  );
}
