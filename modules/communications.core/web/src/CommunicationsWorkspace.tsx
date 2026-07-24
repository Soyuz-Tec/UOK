import { MessageCircleMore } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  loadCommunicationCapabilities,
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
import type { CommunicationCapabilities, CommunicationThread } from "./types";

const readOnlyCapabilities: CommunicationCapabilities = { read: false, create: false, delete: false, restore: false };

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
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [selectedId, setSelectedId] = useState(requestedThreadId);
  const [requestedThread, setRequestedThread] = useState<CommunicationThread | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [contextFilter, setContextFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ThreadSort>("updated");
  const [sortDirection, setSortDirection] = useState<ThreadSortDirection>("desc");
  const [title, setTitle] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<"delete" | "restore" | "">("");
  const [focusCommand, setFocusCommand] = useState<CommunicationFocusCommand>("");
  const [capabilities, setCapabilities] = useState(readOnlyCapabilities);
  const activeOperation = useRef<"refresh" | "create" | "delete" | "restore" | "">("");
  const [status, setStatus] = useState("K Connect ready.");
  const availableThreads = useMemo(
    () => requestedThread && !threads.some((thread) => thread.id === requestedThread.id) ? [requestedThread, ...threads] : threads,
    [requestedThread, threads],
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
    if (!token || !operational) return;
    void refresh();
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
        canCreate={capabilities.create} onQueryChange={setQuery} onStatusChange={setStatusFilter}
        onContextChange={setContextFilter} onSortChange={setSortBy} onSortDirectionChange={setSortDirection}
        onClear={() => { setQuery(""); setStatusFilter("active"); setContextFilter("all"); }}
        onRefresh={() => void refresh()} onOpenCreate={() => { setTitle(""); setCreateOpen(true); }}
      />
      <span className="communications-status" role="status">{status}</span>
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
            canDelete={capabilities.delete}
            canRestore={capabilities.restore}
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

  async function refresh() {
    if (activeOperation.current) return;
    activeOperation.current = "refresh";
    setRefreshing(true);
    try {
      const [nextCapabilities, rows] = await Promise.all([
        loadCommunicationCapabilities(token).catch(() => readOnlyCapabilities),
        loadCommunicationThreads(token, "all"),
      ]);
      setCapabilities(nextCapabilities);
      setThreads(rows);
      setRequestedThread(null);
      if (requestedThreadId) {
        const exact = rows.find((row) => row.id === requestedThreadId) || await loadCommunicationThread(token, requestedThreadId);
        setRequestedThread(exact);
        setSelectedId(exact.id);
      } else {
        if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      }
      setStatus(`${rows.length} authorized thread(s) loaded.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "K Connect refresh failed.");
    } finally {
      activeOperation.current = "";
      setRefreshing(false);
    }
  }

  async function createThread() {
    if (activeOperation.current) return;
    activeOperation.current = "create";
    setCreatingThread(true);
    try {
      const created = await createCommunicationThread(token, { title: title.trim(), context_type: "general" });
      setTitle("");
      setSelectedId(created.id);
      setRequestedThread(created);
      setThreads((current) => [created, ...current.filter((thread) => thread.id !== created.id)]);
      setStatus(`Created ${created.title}.`);
      setCreateOpen(false);
      try {
        setThreads(await loadCommunicationThreads(token, "all"));
        setRequestedThread(null);
      } catch {
        setStatus(`Created ${created.title}. The thread list could not be refreshed; the new thread remains available locally.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Thread creation failed.");
    } finally {
      activeOperation.current = "";
      setCreatingThread(false);
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
    activeOperation.current = action;
    setLifecycleBusy(action);
    try {
      const updated = await mutate(token, thread);
      replaceThread(updated);
      setStatusFilter(nextFilter);
      setSelectedId(updated.id);
      setFocusCommand(action === "delete" ? "restore" : "delete");
      setStatus(action === "delete"
        ? t("communications.noticeDeleted", "Thread deleted from active use. It remains available under Archived.")
        : t("communications.noticeRestored", "Thread restored."));
    } catch (error) {
      if (error instanceof CommunicationApiError && error.stale) {
        const latest = await loadCommunicationThread(token, thread.id, true);
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
      activeOperation.current = "";
      setLifecycleBusy("");
    }
  }

  function replaceThread(updated: CommunicationThread) {
    setThreads((current) => [updated, ...current.filter((thread) => thread.id !== updated.id)]);
    setRequestedThread((current) => current?.id === updated.id ? updated : current);
  }
}
