import { Download, Power } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { Pane, WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { LocationDetail } from "./LocationDetail";
import { LocationEditor } from "./LocationEditor";
import { LocationTable } from "./LocationTable";
import {
  archiveLocationDefinition,
  createLocationDefinition,
  loadLocationDefinitions,
  loadLocationNameHistory,
  restoreLocationDefinition,
  updateLocationDefinition,
} from "./locationApi";
import { filterAndSortLocations } from "./locationFilters";
import { LOCATION_MODULE_ID } from "./locationModule";
import type {
  LocationDefinition,
  LocationDraft,
  LocationNameHistory,
  LocationSort,
  LocationSortDirection,
  LocationStatus,
} from "./types";

type EditorMode = "create" | "edit" | null;

export function LocationMasterWorkspace({ host }: { host: ModuleSurfaceHostContext }) {
  const module = host.moduleRows.find((row) => row.name === LOCATION_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const canManage = ["platform_admin", "ops_manager", "trader"].includes(host.currentUserRole);
  const [locations, setLocations] = useState<LocationDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<LocationNameHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LocationStatus>("active");
  const [sortBy, setSortBy] = useState<LocationSort>("code");
  const [sortDirection, setSortDirection] = useState<LocationSortDirection>("asc");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("Location Master ready.");
  const activeOperation = useRef("");
  const selected = locations.find((location) => location.id === selectedId) || null;
  const visibleLocations = useMemo(() => filterAndSortLocations(locations, {
    query,
    status: statusFilter,
    sortBy,
    sortDirection,
  }), [locations, query, sortBy, sortDirection, statusFilter]);

  const refreshLocations = useCallback(async () => {
    if (!host.token || !operational) return;
    try {
      setBusyAction("refresh");
      const rows = await loadLocationDefinitions(host.token, host.onUnauthorized);
      setLocations(rows);
      setSelectedId((current) => rows.some((location) => location.id === current)
        ? current
        : rows.find((location) => location.status === "active")?.id || rows[0]?.id || "");
      setStatus(`${rows.length} location definition(s) loaded.`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  }, [host.onUnauthorized, host.token, operational]);

  useEffect(() => {
    if (!host.token || !operational) {
      setLocations([]);
      setSelectedId("");
      setHistory([]);
      setEditorMode(null);
      return;
    }
    void refreshLocations();
  }, [host.moduleRefreshRevision, host.token, operational, refreshLocations]);

  useEffect(() => {
    if (!host.token || !operational || !selected) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void loadLocationNameHistory(host.token, selected.id, host.onUnauthorized)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((error) => {
        if (active) setStatus(errorMessage(error));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [host.onUnauthorized, host.token, operational, selected?.id, selected?.version]);

  if (!host.token) return <EmptyState text="Sign in to open Location Master." />;
  if (!operational) return <LocationModuleState module={module} host={host} />;

  return (
    <section className="location-master-workspace" aria-label="Location Master">
      <WorkspaceCommandBar
        label="Location Master controls"
        query={(
          <SearchWorkspace
            label="Search location definitions"
            value={query}
            placeholder="Search locations"
            defaultSummaryLabel="Active locations"
            filters={[{
              id: "status",
              label: "Status",
              value: statusFilter,
              defaultValue: "active",
              options: statusOptions,
              onChange: (value) => setStatusFilter(value as "all" | LocationStatus),
            }]}
            sort={{
              label: "Location sort field",
              value: sortBy,
              defaultValue: "code",
              options: [{ value: "code", label: "Code" }, { value: "name", label: "Name" }],
              direction: sortDirection,
              defaultDirection: "asc",
              onChange: (value) => setSortBy(value as LocationSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_location_master_saved_search_views"
            onChange={setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              setQuery("");
              setStatusFilter("active");
            }}
          />
        )}
        secondaryActions={<WorkspaceActionsMenu items={[{
          id: "refresh",
          action: "refresh",
          loading: busyAction === "refresh",
          disabled: Boolean(activeOperation.current),
          onSelect: () => void refreshLocations(),
        }]} />}
        primaryAction={canManage ? <WorkspaceActionButton action="create" labelKey="command.newLocation" fallbackLabel="New location" primary disabled={Boolean(busyAction)} onClick={openCreate} /> : null}
      />
      <p className="location-master-status" role="status">{status}</p>
      <WorkflowSplitView
        primaryLabel="Location definitions"
        secondaryLabel="Location details"
        primary={<LocationTable locations={visibleLocations} selectedId={selectedId} onSelect={setSelectedId} />}
        secondary={(
          <LocationDetail
            location={selected}
            history={history}
            historyLoading={historyLoading}
            busyAction={busyAction}
            canManage={canManage}
            onEdit={() => {
              setEditorError("");
              setEditorMode("edit");
            }}
            onArchive={() => selected && void runLifecycle("archive", selected)}
            onRestore={() => selected && void runLifecycle("restore", selected)}
          />
        )}
      />
      <WorkspaceEditorPopup
        open={editorMode !== null}
        label={editorMode === "create" ? "Create location definition" : "Edit location definition"}
        title={editorMode === "create" ? "New location" : "Edit location"}
        description="Govern canonical operational location identity without creating routes or transaction records."
        dismissible={!activeOperation.current}
        onClose={closeEditor}
      >
        {editorMode ? (
          <LocationEditor
            mode={editorMode}
            location={editorMode === "edit" ? selected : null}
            busy={busyAction === "create" || busyAction === "update"}
            error={editorError}
            onCancel={closeEditor}
            onSubmit={(draft) => void saveLocation(editorMode, draft)}
          />
        ) : null}
      </WorkspaceEditorPopup>
    </section>
  );

  function openCreate() {
    if (!canManage) return;
    setEditorError("");
    setEditorMode("create");
  }

  function closeEditor() {
    if (activeOperation.current) return;
    setEditorMode(null);
    setEditorError("");
  }

  async function saveLocation(mode: Exclude<EditorMode, null>, draft: LocationDraft) {
    if (!canManage || activeOperation.current || (mode === "edit" && !selected)) return;
    const action = mode === "create" ? "create" : "update";
    await runMutation(action, async () => mode === "create"
      ? createLocationDefinition(host.token, draft, host.onUnauthorized)
      : updateLocationDefinition(host.token, selected!, draft, host.onUnauthorized));
  }

  async function runLifecycle(action: "archive" | "restore", location: LocationDefinition) {
    if (!canManage || activeOperation.current) return;
    await runMutation(action, () => action === "archive"
      ? archiveLocationDefinition(host.token, location, host.onUnauthorized)
      : restoreLocationDefinition(host.token, location, host.onUnauthorized));
    setStatusFilter(action === "archive" ? "all" : "active");
  }

  async function runMutation(action: string, operation: () => Promise<LocationDefinition>) {
    activeOperation.current = action;
    setBusyAction(action);
    setEditorError("");
    try {
      const location = await operation();
      setLocations((current) => [location, ...current.filter((row) => row.id !== location.id)]);
      setSelectedId(location.id);
      setEditorMode(null);
      setStatus(`${actionLabel(action)} ${location.canonical_name}.`);
      void host.refreshHost().catch(() => undefined);
    } catch (error) {
      const message = errorMessage(error);
      if (action === "create" || action === "update") setEditorError(message);
      setStatus(message);
    } finally {
      activeOperation.current = "";
      setBusyAction("");
    }
  }
}

function LocationModuleState({ module, host }: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  return (
    <Pane title="Location Master" description="Module state" wide>
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line"><h2 className="module-name">locations.core</h2><StatusPill label={module?.status || "available"} tone="info" /></div>
          <p className="module-meta">Canonical tenant-scoped operational locations</p>
        </div>
        <CommandButton icon={Icon} loading={host.busyAction === `${LOCATION_MODULE_ID}:${action}`} onClick={() => void host.moduleAction(LOCATION_MODULE_ID, action)}>{action === "enable" ? "Enable Location Master" : "Install Location Master"}</CommandButton>
      </div>
    </Pane>
  );
}

const statusOptions = [
  { value: "active", label: "Active locations" },
  { value: "all", label: "All locations" },
  { value: "archived", label: "Archived locations" },
];

function actionLabel(action: string) {
  return ({ create: "Created", update: "Updated", archive: "Archived", restore: "Restored" } as Record<string, string>)[action] || "Changed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Location Master request failed.";
}
