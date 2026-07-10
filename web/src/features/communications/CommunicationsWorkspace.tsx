import { MessageCircleMore, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../shared/data-display";
import { Pane, WorkflowHeader } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import type { ModuleStatus } from "../../shared/types";
import { createCommunicationThread, loadCommunicationThread, loadCommunicationThreads } from "./communicationsApi";
import { COMMUNICATIONS_MODULE_ID } from "./communicationsModule";
import type { CommunicationThread } from "./types";

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
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("K Connect ready.");
  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) || requestedThread || threads[0] || null,
    [requestedThread, selectedId, threads],
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
      <WorkflowHeader eyebrow="K Connect" title="Communication threads" summary="Open the exact authorized room linked from operational work.">
        <CommandButton icon={RefreshCw} loading={busy === "refresh"} onClick={() => void refresh()}>Refresh</CommandButton>
      </WorkflowHeader>
      <span className="communications-status" role="status">{status}</span>
      <div className="communications-layout">
        <Pane title="Threads" description={`${threads.length} visible`}>
          <div className="communications-create">
            <label className="field"><span>Thread title</span><input value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} /></label>
            <CommandButton icon={Plus} loading={busy === "create"} disabled={title.trim().length < 2} onClick={() => void createThread()}>Create thread</CommandButton>
          </div>
          <div className="communications-thread-list">
            {threads.map((thread) => <button key={thread.id} type="button" className={selected?.id === thread.id ? "selected" : ""} onClick={() => setSelectedId(thread.id)}>
              <strong>{thread.title}</strong><small>{thread.context_type} · {thread.status}</small>
            </button>)}
            {!threads.length ? <EmptyState text="No communication threads are available." /> : null}
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
    </section>
  );

  async function refresh() {
    setBusy("refresh");
    try {
      const rows = await loadCommunicationThreads(token);
      setThreads(rows);
      if (requestedThreadId) {
        const exact = rows.find((row) => row.id === requestedThreadId) || await loadCommunicationThread(token, requestedThreadId);
        setRequestedThread(exact);
        setSelectedId(exact.id);
      } else if (!selectedId && rows[0]) setSelectedId(rows[0].id);
      setStatus(`${rows.length} authorized thread(s) loaded.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "K Connect refresh failed.");
    } finally {
      setBusy("");
    }
  }

  async function createThread() {
    setBusy("create");
    try {
      const created = await createCommunicationThread(token, { title: title.trim(), context_type: "general" });
      setTitle("");
      setSelectedId(created.id);
      setRequestedThread(created);
      setThreads(await loadCommunicationThreads(token));
      setStatus(`Created ${created.title}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Thread creation failed.");
    } finally {
      setBusy("");
    }
  }
}
