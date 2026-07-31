import { MessageCircleMore } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ModuleStatus } from "@uok/shared/types";
import { CommunicationsCommandSurface, CommunicationsThreadCreator } from "./CommunicationsControls";
import { CommunicationThreadDetail, type CommunicationFocusCommand } from "./CommunicationThreadDetail";
import {
  CommunicationApiError,
  createCommunicationThread,
  deleteCommunicationThread,
  loadCommunicationThread,
  loadCommunicationThreads,
  restoreCommunicationThread,
} from "./communicationsApi";
import { COMMUNICATIONS_MODULE_ID } from "./communicationsModule";
import {
  filterAndSortThreads,
  threadOptions,
  type ThreadSort,
  type ThreadSortDirection,
} from "./communicationsWorkspaceModel";
import type { CommunicationThread } from "./types";
import { useCommunicationThreadCatalog } from "./useCommunicationThreadCatalog";

export function CommunicationsWorkspace({ token, moduleRows, busyAction, onInstall }: {
  token: string;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onInstall: () => void;
}) {
  const { t } = useUokLocalization();
  const module = moduleRows.find((row) => row.name === COMMUNICATIONS_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const requestedThreadId = new URLSearchParams(window.location.search).get("thread_id") || "";
  const catalog = useCommunicationThreadCatalog({ token, operational, requestedThreadId });
  const {
    activeOperation, authorizedCapabilities, authorizedRequestedThread, authorizedThreads,
    captureSession, refresh, refreshing, selectedId, sessionMatches, setRequestedThread,
    setSelectedId, setStatus, setThreads, status,
  } = catalog;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [contextFilter, setContextFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ThreadSort>("updated");
  const [sortDirection, setSortDirection] = useState<ThreadSortDirection>("desc");
  const [title, setTitle] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<"delete" | "restore" | "">("");
  const [focusCommand, setFocusCommand] = useState<CommunicationFocusCommand>("");
  const availableThreads = useMemo(
    () => authorizedRequestedThread && !authorizedThreads.some((thread) => thread.id === authorizedRequestedThread.id)
      ? [authorizedRequestedThread, ...authorizedThreads]
      : authorizedThreads,
    [authorizedRequestedThread, authorizedThreads],
  );
  const visibleThreads = useMemo(
    () => filterAndSortThreads(availableThreads, { contextFilter, query, sortBy, sortDirection, statusFilter }),
    [availableThreads, contextFilter, query, sortBy, sortDirection, statusFilter],
  );
  const selected = useMemo(
    () => visibleThreads.find((thread) => thread.id === selectedId) || visibleThreads[0] || null,
    [selectedId, visibleThreads],
  );
  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("communications.activeThreads", "Active threads") },
      { value: "open", label: t("communications.openThreads", "Open threads") },
      { value: "closed", label: t("communications.closedThreads", "Closed threads") },
      { value: "archived", label: t("communications.archivedThreads", "Archived threads") },
      { value: "all", label: t("communications.allThreads", "All threads") },
    ],
    [t],
  );
  const contextOptions = useMemo(
    () => threadOptions(availableThreads, "context_type", "All contexts"),
    [availableThreads],
  );
  const operationBusy = refreshing || creatingThread || Boolean(lifecycleBusy);

  useEffect(() => {
    setCreateOpen(false);
    setCreatingThread(false);
    setLifecycleBusy("");
    setFocusCommand("");
    setTitle("");
  }, [operational, token]);

  if (!operational) {
    return <Pane title="K Connect" description="Communication threads" wide>
      <EmptyState text="Install communications.core to open organization communication threads." />
      <CommandButton icon={MessageCircleMore} loading={busyAction === `install:${COMMUNICATIONS_MODULE_ID}`} onClick={onInstall}>Install K Connect</CommandButton>
    </Pane>;
  }

  return (
    <section className="communications-workspace" aria-label="K Connect">
      <CommunicationsCommandSurface
        query={query} statusFilter={statusFilter} contextFilter={contextFilter}
        sortBy={sortBy} sortDirection={sortDirection} statusOptions={statusOptions}
        contextOptions={contextOptions} refreshing={refreshing} operationBusy={operationBusy}
        canCreate={authorizedCapabilities.create} onQueryChange={setQuery} onStatusChange={setStatusFilter}
        onContextChange={setContextFilter} onSortChange={setSortBy} onSortDirectionChange={setSortDirection}
        onClear={() => { setQuery(""); setStatusFilter("active"); setContextFilter("all"); }}
        onRefresh={() => void refresh()} onOpenCreate={() => { setTitle(""); setCreateOpen(true); }}
      />
      <span className="communications-status" role="status">
        {sessionMatches ? status : "Loading authorized threads."}
      </span>
      <div className="communications-layout">
        <Pane title="Threads" description={`${visibleThreads.length} of ${availableThreads.length} visible`}>
          <div className="communications-thread-list">
            {visibleThreads.map((thread) => <button key={thread.id} type="button" className={selected?.id === thread.id ? "selected" : ""} onClick={() => setSelectedId(thread.id)}>
              <strong>{thread.title}</strong><small>{thread.context_type} · {thread.status}</small>
            </button>)}
            {!visibleThreads.length ? <EmptyState text={availableThreads.length ? "No communication threads match the current search." : "No communication threads are available."} /> : null}
          </div>
        </Pane>
        <Pane title="Thread" description={selected?.status || "No selection"} wide>
          <CommunicationThreadDetail
            thread={selected}
            canDelete={authorizedCapabilities.delete}
            canRestore={authorizedCapabilities.restore}
            busyAction={lifecycleBusy}
            focusCommand={focusCommand}
            onDelete={deleteThread}
            onRestore={restoreThread}
            onFocusRecovered={() => setFocusCommand("")}
          />
        </Pane>
      </div>
      <CommunicationsThreadCreator
        open={createOpen} title={title} creating={creatingThread} operationBusy={operationBusy}
        onTitleChange={setTitle} onClose={() => setCreateOpen(false)} onSubmit={() => void createThread()}
      />
    </section>
  );

  async function createThread() {
    if (activeOperation.current) return;
    const isCurrent = captureSession();
    activeOperation.current = "create";
    setCreatingThread(true);
    try {
      const created = await createCommunicationThread(token, { title: title.trim(), context_type: "general" });
      if (!isCurrent()) return;
      setTitle("");
      setSelectedId(created.id);
      setRequestedThread(created);
      setThreads((current) => [created, ...current.filter((thread) => thread.id !== created.id)]);
      setStatus(`Created ${created.title}.`);
      setCreateOpen(false);
      try {
        const rows = await loadCommunicationThreads(token, "all");
        if (!isCurrent()) return;
        setThreads(rows);
        setRequestedThread(null);
      } catch {
        if (isCurrent()) {
          setStatus(`Created ${created.title}. The thread list could not be refreshed; the new thread remains available locally.`);
        }
      }
    } catch (error) {
      if (isCurrent()) {
        setStatus(error instanceof Error ? error.message : "Thread creation failed.");
      }
    } finally {
      if (isCurrent()) {
        activeOperation.current = "";
        setCreatingThread(false);
      }
    }
  }

  async function deleteThread(thread: CommunicationThread) {
    await changeThreadLifecycle("delete", thread, deleteCommunicationThread, "archived");
  }

  async function restoreThread(thread: CommunicationThread) {
    await changeThreadLifecycle("restore", thread, restoreCommunicationThread, "active");
  }

  async function changeThreadLifecycle(
    action: "delete" | "restore",
    thread: CommunicationThread,
    mutate: (token: string, thread: CommunicationThread) => Promise<CommunicationThread>,
    nextFilter: "active" | "archived",
  ) {
    if (activeOperation.current) throw new Error(t("communications.operationBusy", "Another K Connect operation is still running."));
    const isCurrent = captureSession();
    activeOperation.current = action;
    setLifecycleBusy(action);
    try {
      const updated = await mutate(token, thread);
      if (!isCurrent()) return;
      replaceThread(updated);
      setStatusFilter(nextFilter);
      setSelectedId(updated.id);
      setFocusCommand(action === "delete" ? "restore" : "delete");
      setStatus(action === "delete"
        ? t("communications.noticeDeleted", "Thread deleted from active use. It remains available under Archived.")
      : t("communications.noticeRestored", "Thread restored."));
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof CommunicationApiError && error.stale) {
        const latest = await loadCommunicationThread(token, thread.id, true);
        if (!isCurrent()) return;
        replaceThread(latest);
        setStatusFilter(latest.status === "archived" ? "archived" : "active");
        setSelectedId(latest.id);
        setFocusCommand(latest.status === "archived" ? "restore" : "delete");
        setStatus(`${error.message} ${error.repair}`.trim());
        return;
      }
      setStatus(error instanceof Error ? error.message : t("communications.lifecycleFailed", "Thread lifecycle change failed."));
      throw error;
    } finally {
      if (isCurrent()) {
        activeOperation.current = "";
        setLifecycleBusy("");
      }
    }
  }

  function replaceThread(updated: CommunicationThread) {
    setThreads((current) => [updated, ...current.filter((thread) => thread.id !== updated.id)]);
    setRequestedThread((current) => current?.id === updated.id ? updated : current);
  }
}
