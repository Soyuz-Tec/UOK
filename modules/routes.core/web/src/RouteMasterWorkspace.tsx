import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { RouteDetail } from "./RouteDetail";
import { RouteEditor } from "./RouteEditor";
import { RouteModuleState } from "./RouteModuleState";
import { RouteTable } from "./RouteTable";
import {
  archiveRouteDefinition,
  createRouteDefinition,
  loadLocationOptions,
  loadRouteDefinition,
  loadRouteDefinitions,
  loadRouteNameHistory,
  restoreRouteDefinition,
  updateRouteDefinition,
} from "./routeApi";
import { filterAndSortRoutes } from "./routeFilters";
import { ROUTE_MODULE_ID } from "./routeModule";
import type {
  LocationReference,
  RouteDefinition,
  RouteDraft,
  RouteMode,
  RouteNameHistory,
  RouteSort,
  RouteSortDirection,
  RouteStatus,
} from "./types";

type EditorMode = "create" | "edit" | null;

export function RouteMasterWorkspace({ host }: { host: ModuleSurfaceHostContext }) {
  const module = host.moduleRows.find((row) => row.name === ROUTE_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const canManage = ["platform_admin", "ops_manager", "trader"].includes(host.currentUserRole);
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationReference[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<RouteDefinition | null>(null);
  const [history, setHistory] = useState<RouteNameHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RouteStatus>("active");
  const [modeFilter, setModeFilter] = useState<"all" | RouteMode>("all");
  const [sortBy, setSortBy] = useState<RouteSort>("code");
  const [sortDirection, setSortDirection] = useState<RouteSortDirection>("asc");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("Route/Corridor Master ready.");
  const activeOperation = useRef("");
  const listSelected = routes.find((route) => route.id === selectedId) || null;
  const selected = detail?.id === selectedId ? detail : listSelected;
  const visibleRoutes = useMemo(() => filterAndSortRoutes(routes, {
    query,
    status: statusFilter,
    mode: modeFilter,
    sortBy,
    sortDirection,
  }), [modeFilter, query, routes, sortBy, sortDirection, statusFilter]);

  const refreshRoutes = useCallback(async () => {
    if (!host.session.token || !operational) return;
    try {
      setBusyAction("refresh");
      const [routeRows, optionRows] = await Promise.all([
        loadRouteDefinitions(host.session.token, host.session.onUnauthorized),
        loadLocationOptions(host.session.token, host.session.onUnauthorized),
      ]);
      setRoutes(routeRows);
      setLocationOptions(optionRows);
      setSelectedId((current) => routeRows.some((route) => route.id === current)
        ? current
        : routeRows.find((route) => route.status === "active")?.id || routeRows[0]?.id || "");
      setStatus(`${routeRows.length} Route Definition(s) loaded.`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  }, [host.session.onUnauthorized, host.session.token, operational]);

  useEffect(() => {
    if (!host.session.token || !operational) {
      setRoutes([]);
      setLocationOptions([]);
      setSelectedId("");
      setDetail(null);
      setHistory([]);
      setEditorMode(null);
      return;
    }
    void refreshRoutes();
  }, [host.moduleRefreshRevision, host.session.token, operational, refreshRoutes]);

  useEffect(() => {
    if (!host.session.token || !operational || !selectedId) {
      setDetail(null);
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void Promise.all([
      loadRouteDefinition(host.session.token, selectedId, host.session.onUnauthorized),
      loadRouteNameHistory(host.session.token, selectedId, host.session.onUnauthorized),
    ]).then(([route, rows]) => {
      if (!active) return;
      setDetail(route);
      setHistory(rows);
    }).catch((error) => {
      if (active) setStatus(errorMessage(error));
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => {
      active = false;
    };
  }, [host.moduleRefreshRevision, host.session.onUnauthorized, host.session.token, operational, selectedId, listSelected?.version]);

  if (!host.session.token) return <EmptyState text="Sign in to open Route/Corridor Master." />;
  if (!operational) return <RouteModuleState module={module} host={host} />;

  return (
    <section className="route-master-workspace" aria-label="Route/Corridor Master">
      <WorkspaceCommandBar
        label="Route/Corridor Master controls"
        query={(
          <SearchWorkspace
            label="Search Route Definitions"
            value={query}
            placeholder="Search routes"
            defaultSummaryLabel="Active routes"
            filters={[
              { id: "status", label: "Status", value: statusFilter, defaultValue: "active", options: statusOptions, onChange: (value) => setStatusFilter(value as "all" | RouteStatus) },
              { id: "mode", label: "Mode", value: modeFilter, defaultValue: "all", options: modeOptions, onChange: (value) => setModeFilter(value as "all" | RouteMode) },
            ]}
            sort={{
              label: "Route sort field",
              value: sortBy,
              defaultValue: "code",
              options: [{ value: "code", label: "Code" }, { value: "name", label: "Name" }],
              direction: sortDirection,
              defaultDirection: "asc",
              onChange: (value) => setSortBy(value as RouteSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_route_master_saved_search_views"
            onChange={setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              setQuery("");
              setStatusFilter("active");
              setModeFilter("all");
            }}
          />
        )}
        secondaryActions={<WorkspaceActionsMenu items={[{
          id: "refresh",
          action: "refresh",
          loading: busyAction === "refresh",
          disabled: Boolean(activeOperation.current),
          onSelect: () => void refreshRoutes(),
        }]} />}
        primaryAction={canManage ? <WorkspaceActionButton action="create" labelKey="command.newRoute" fallbackLabel="New route" primary disabled={Boolean(busyAction)} onClick={openCreate} /> : null}
      />
      <p className="route-master-status" role="status">{status}</p>
      <WorkflowSplitView
        primaryLabel="Route definitions"
        secondaryLabel="Route details"
        primary={<RouteTable routes={visibleRoutes} selectedId={selectedId} onSelect={setSelectedId} />}
        secondary={(
          <RouteDetail
            route={selected}
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
        label={editorMode === "create" ? "Create route definition" : "Edit route definition"}
        title={editorMode === "create" ? "New route" : "Edit route"}
        description="Govern an ordered Location path without executing a shipment or calculating a route."
        dismissible={!activeOperation.current}
        onClose={closeEditor}
      >
        {editorMode ? (
          <RouteEditor
            mode={editorMode}
            route={editorMode === "edit" ? selected : null}
            locationOptions={locationOptions}
            busy={busyAction === "create" || busyAction === "update"}
            error={editorError}
            onCancel={closeEditor}
            onSubmit={(draft) => void saveRoute(editorMode, draft)}
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

  async function saveRoute(mode: Exclude<EditorMode, null>, draft: RouteDraft) {
    if (!canManage || activeOperation.current || (mode === "edit" && !selected)) return;
    const action = mode === "create" ? "create" : "update";
    await runMutation(action, () => mode === "create"
      ? createRouteDefinition(host.session.token, draft, host.session.onUnauthorized)
      : updateRouteDefinition(host.session.token, selected!, draft, host.session.onUnauthorized));
  }

  async function runLifecycle(action: "archive" | "restore", route: RouteDefinition) {
    if (!canManage || activeOperation.current) return;
    const changed = await runMutation(action, () => action === "archive"
      ? archiveRouteDefinition(host.session.token, route, host.session.onUnauthorized)
      : restoreRouteDefinition(host.session.token, route, host.session.onUnauthorized));
    if (changed) setStatusFilter(action === "archive" ? "all" : "active");
  }

  async function runMutation(action: string, operation: () => Promise<RouteDefinition>) {
    activeOperation.current = action;
    setBusyAction(action);
    setEditorError("");
    try {
      const route = await operation();
      setRoutes((current) => [route, ...current.filter((row) => row.id !== route.id)]);
      setSelectedId(route.id);
      setDetail(route);
      setEditorMode(null);
      setStatus(`${actionLabel(action)} ${route.canonical_name}.`);
      void host.refreshHost().catch(() => undefined);
      return true;
    } catch (error) {
      const message = errorMessage(error);
      if (action === "create" || action === "update") setEditorError(message);
      setStatus(message);
      return false;
    } finally {
      activeOperation.current = "";
      setBusyAction("");
    }
  }
}

const statusOptions = [
  { value: "active", label: "Active routes" },
  { value: "all", label: "All routes" },
  { value: "archived", label: "Archived routes" },
];

const modeOptions = [
  { value: "all", label: "All modes" },
  { value: "sea", label: "Sea" },
  { value: "road", label: "Road" },
  { value: "rail", label: "Rail" },
  { value: "air", label: "Air" },
  { value: "multimodal", label: "Multimodal" },
];

function actionLabel(action: string) {
  return ({ create: "Created", update: "Updated", archive: "Archived", restore: "Restored" } as Record<string, string>)[action] || "Changed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Route/Corridor Master request failed.";
}
