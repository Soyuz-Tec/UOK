import { MessageCircleMore } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@uok/shared/data-display";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { SearchWorkspace } from "@uok/shared/forms";
import { Pane, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import type { ModuleStatus } from "@uok/shared/types";
import { createCommunicationThread, loadCommunicationThread, loadCommunicationThreads } from "./communicationsApi";
import { COMMUNICATIONS_MODULE_ID } from "./communicationsModule";
import type { CommunicationThread } from "./types";

type ThreadSort = "updated" | "title";
type ThreadSortDirection = "asc" | "desc";

export function CommunicationsWorkspace({ token, moduleRows, busyAction, onInstall }: {
  token: string;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onInstall: () => void;
}) {
  const module = moduleRows.find((row) => row.name === COMMUNICATIONS_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const requestedThreadId = new URLSearchParams(window.location.search).get("thread_id") || "";
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [selectedId, setSelectedId] = useState(requestedThreadId);
  const [requestedThread, setRequestedThread] = useState<CommunicationThread | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contextFilter, setContextFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ThreadSort>("updated");
  const [sortDirection, setSortDirection] = useState<ThreadSortDirection>("desc");
  const [title, setTitle] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const activeOperation = useRef<"refresh" | "create" | "">("");
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
    () => threadOptions(availableThreads, "status", "All statuses"),
    [availableThreads],
  );
  const contextOptions = useMemo(
    () => threadOptions(availableThreads, "context_type", "All contexts"),
    [availableThreads],
  );

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
      <WorkspaceCommandBar
        label="K Connect controls"
        query={(
          <SearchWorkspace
            label="Search communication threads"
            value={query}
            placeholder="Search threads"
            defaultSummaryLabel="All threads"
            filters={[
              { id: "status", label: "Status", value: statusFilter, defaultValue: "all", options: statusOptions, onChange: setStatusFilter },
              { id: "context", label: "Context", value: contextFilter, defaultValue: "all", options: contextOptions, onChange: setContextFilter },
            ]}
            sort={{
              label: "Thread sort field",
              value: sortBy,
              defaultValue: "updated",
              options: [{ value: "updated", label: "Updated" }, { value: "title", label: "Title" }],
              direction: sortDirection,
              defaultDirection: "desc",
              onChange: (value) => setSortBy(value as ThreadSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_communications_saved_search_views"
            onChange={setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              setQuery("");
              setStatusFilter("all");
              setContextFilter("all");
            }}
          />
        )}
        secondaryActions={<WorkspaceActionsMenu items={[
          { id: "refresh", action: "refresh", loading: refreshing, disabled: creatingThread, onSelect: () => void refresh() },
        ]} />}
        primaryAction={(
          <WorkspaceActionButton action="create" labelKey="command.newThread" fallbackLabel="New thread" primary disabled={refreshing || creatingThread} onClick={() => {
            setTitle("");
            setCreateOpen(true);
          }} />
        )}
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
          {selected ? <article className="communications-thread-detail" data-thread-id={selected.id}>
            <h2>{selected.title}</h2>
            <dl>
              <div><dt>Thread ID</dt><dd>{selected.id}</dd></div>
              <div><dt>Context</dt><dd>{selected.context_type}{selected.context_id ? ` · ${selected.context_id}` : ""}</dd></div>
              <div><dt>Last activity</dt><dd>{new Date(selected.updated_at).toLocaleString()}</dd></div>
            </dl>
            <p>This governed thread is ready for linked operational conversation. Message exchange is a later K Connect capability.</p>
          </article> : <EmptyState text="Select a communication thread." />}
        </Pane>
      </div>
      <WorkspaceEditorPopup
        open={createOpen}
        label="Create communication thread"
        title="New thread"
        description="Create a governed organization thread without leaving K Connect."
        onClose={() => {
          if (!creatingThread) setCreateOpen(false);
        }}
      >
        <form className="communications-create-form" onSubmit={(event) => {
          event.preventDefault();
          void createThread();
        }}>
          <label className="field"><span>Thread title</span><input autoFocus value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="communications-create-actions">
            <WorkspaceActionButton action="cancel" disabled={creatingThread} onClick={() => setCreateOpen(false)} />
            <WorkspaceActionButton action="create" labelKey="command.createThread" fallbackLabel="Create thread" type="submit" primary loading={creatingThread} disabled={refreshing || title.trim().length < 2} />
          </div>
        </form>
      </WorkspaceEditorPopup>
    </section>
  );

  async function refresh() {
    if (activeOperation.current) return;
    activeOperation.current = "refresh";
    setRefreshing(true);
    try {
      const rows = await loadCommunicationThreads(token);
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
        setThreads(await loadCommunicationThreads(token));
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
}

function filterAndSortThreads(threads: CommunicationThread[], options: {
  contextFilter: string;
  query: string;
  sortBy: ThreadSort;
  sortDirection: ThreadSortDirection;
  statusFilter: string;
}) {
  const normalizedQuery = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return threads
    .filter((thread) => {
      if (options.statusFilter !== "all" && thread.status !== options.statusFilter) return false;
      if (options.contextFilter !== "all" && thread.context_type !== options.contextFilter) return false;
      if (!normalizedQuery) return true;
      return `${thread.title} ${thread.context_type} ${thread.context_id || ""}`.toLocaleLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => {
      const comparison = options.sortBy === "title"
        ? left.title.localeCompare(right.title)
        : left.updated_at.localeCompare(right.updated_at);
      return direction * (comparison || left.title.localeCompare(right.title));
    });
}

function threadOptions(threads: CommunicationThread[], field: "status" | "context_type", allLabel: string) {
  const values = Array.from(new Set(threads.map((thread) => thread[field]))).sort();
  return [{ value: "all", label: allLabel }, ...values.map((value) => ({ value, label: value.replaceAll("_", " ") }))];
}
