import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { ShipmentDetail } from "./ShipmentDetail";
import { ShipmentDocumentEvidencePanels } from "./ShipmentDocumentEvidencePanels";
import { ShipmentEditor } from "./ShipmentEditor";
import { ShipmentModuleState } from "./ShipmentModuleState";
import { ShipmentTable } from "./ShipmentTable";
import {
  createShipment,
  loadLocationOptions,
  loadRouteOptions,
  loadShipment,
  loadShipments,
  loadShipmentStatusHistory,
  resolvePartyReference,
  transitionShipmentStatus,
  updateShipment,
} from "./shipmentApi";
import { filterAndSortShipments, shipmentStatusOptions } from "./shipmentFilters";
import { SHIPMENT_MODULE_ID } from "./shipmentModule";
import type {
  LocationReference,
  RoutePathReference,
  Shipment,
  ShipmentDraft,
  ShipmentSort,
  ShipmentSortDirection,
  ShipmentStatus,
  ShipmentStatusHistory,
} from "./types";
type EditorMode = "create" | "edit" | null;
export function ShipmentSupportWorkspace({ host }: { host: ModuleSurfaceHostContext }) {
  const module = host.moduleRows.find((row) => row.name === SHIPMENT_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const canManage = ["platform_admin", "ops_manager", "trader"].includes(host.currentUserRole);
  const requestedShipmentId = new URLSearchParams(window.location.search).get("shipment_id") || "";
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationReference[]>([]);
  const [routeOptions, setRouteOptions] = useState<RoutePathReference[]>([]);
  const [selectedId, setSelectedId] = useState(requestedShipmentId);
  const [detail, setDetail] = useState<Shipment | null>(null);
  const [history, setHistory] = useState<ShipmentStatusHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ShipmentStatus>("all");
  const [sortBy, setSortBy] = useState<ShipmentSort>("code");
  const [sortDirection, setSortDirection] = useState<ShipmentSortDirection>("asc");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("Shipment Support ready.");
  const activeOperation = useRef("");
  const listSelected = shipments.find((shipment) => shipment.id === selectedId) || null;
  const selected = detail?.id === selectedId ? detail : listSelected;
  const visibleShipments = useMemo(() => filterAndSortShipments(shipments, {
    query,
    status: statusFilter,
    sortBy,
    sortDirection,
  }), [query, shipments, sortBy, sortDirection, statusFilter]);
  const refreshShipments = useCallback(async () => {
    if (!host.token || !operational) return;
    try {
      setBusyAction("refresh");
      const [shipmentRows, locations, routes] = await Promise.all([
        loadShipments(host.token, host.onUnauthorized),
        loadLocationOptions(host.token, host.onUnauthorized),
        loadRouteOptions(host.token, host.onUnauthorized),
      ]);
      setShipments(shipmentRows);
      setLocationOptions(locations);
      setRouteOptions(routes);
      setSelectedId((current) => requestedShipmentId || (shipmentRows.some((shipment) => shipment.id === current)
        ? current
        : shipmentRows.find((shipment) => !["closed", "cancelled"].includes(shipment.status))?.id || shipmentRows[0]?.id || ""));
      setStatus(`${shipmentRows.length} Shipment(s) loaded.`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  }, [host.onUnauthorized, host.token, operational, requestedShipmentId]);
  useEffect(() => {
    if (!host.token || !operational) {
      setShipments([]);
      setLocationOptions([]);
      setRouteOptions([]);
      setSelectedId("");
      setDetail(null);
      setHistory([]);
      setEditorMode(null);
      return;
    }
    void refreshShipments();
  }, [host.moduleRefreshRevision, host.token, operational, refreshShipments]);
  useEffect(() => {
    if (!host.token || !operational || !selectedId) {
      setDetail(null);
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void Promise.all([
      loadShipment(host.token, selectedId, host.onUnauthorized),
      loadShipmentStatusHistory(host.token, selectedId, host.onUnauthorized),
    ]).then(([shipment, rows]) => {
      if (!active) return;
      setDetail(shipment);
      setHistory(rows);
    }).catch((error) => {
      if (active) setStatus(errorMessage(error));
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => {
      active = false;
    };
  }, [host.moduleRefreshRevision, host.onUnauthorized, host.token, operational, selectedId, listSelected?.version]);
  if (!host.token) return <EmptyState text="Sign in to open Shipment Support." />;
  if (!operational) return <ShipmentModuleState module={module} host={host} />;
  return (
    <section className="shipment-support-workspace" aria-label="Shipment Support">
      <WorkspaceCommandBar
        label="Shipment Support controls"
        query={(
          <SearchWorkspace
            label="Search Shipments"
            value={query}
            placeholder="Search shipments"
            defaultSummaryLabel="All shipments"
            filters={[{
              id: "status",
              label: "Status",
              value: statusFilter,
              defaultValue: "all",
              options: shipmentStatusOptions,
              onChange: (value) => setStatusFilter(value as "all" | ShipmentStatus),
            }]}
            sort={{
              label: "Shipment sort field",
              value: sortBy,
              defaultValue: "code",
              options: [{ value: "code", label: "Code" }, { value: "departure", label: "Planned departure" }],
              direction: sortDirection,
              defaultDirection: "asc",
              onChange: (value) => setSortBy(value as ShipmentSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_shipment_support_saved_search_views"
            onChange={setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              setQuery("");
              setStatusFilter("all");
            }}
          />
        )}
        secondaryActions={<WorkspaceActionsMenu items={[{
          id: "refresh",
          action: "refresh",
          loading: busyAction === "refresh",
          disabled: Boolean(activeOperation.current),
          onSelect: () => void refreshShipments(),
        }]} />}
        primaryAction={canManage ? <WorkspaceActionButton action="create" labelKey="command.newShipment" fallbackLabel="New shipment" primary disabled={Boolean(busyAction)} onClick={openCreate} /> : null}
      />
      <p className="shipment-support-status" role="status">{status}</p>
      <WorkflowSplitView
        primaryLabel="Shipment records"
        secondaryLabel="Shipment details"
        primary={<ShipmentTable shipments={visibleShipments} selectedId={selectedId} onSelect={setSelectedId} />}
        secondary={(
          <ShipmentDetail
            shipment={selected}
            history={history}
            historyLoading={historyLoading}
            busyAction={busyAction}
            canManage={canManage}
            documentEvidence={selected ? (
              <ShipmentDocumentEvidencePanels
                key={`${host.token}:${host.currentUserRole}:${selected.id}`}
                token={host.token}
                shipmentId={selected.id}
                canManage={canManage}
                onUnauthorized={host.onUnauthorized}
                onStatus={setStatus}
              />
            ) : null}
            onEdit={() => {
              setEditorError("");
              setEditorMode("edit");
            }}
            onTransition={(newStatus, reason) => selected && void runTransition(selected, newStatus, reason)}
          />
        )}
      />
      <WorkspaceEditorPopup
        open={editorMode !== null}
        label={editorMode === "create" ? "Create shipment" : "Edit shipment"}
        title={editorMode === "create" ? "New shipment" : "Edit shipment"}
        description="Record one tenant Shipment header over governed Parties, Locations, and an optional Route."
        dismissible={!activeOperation.current}
        onClose={closeEditor}
      >
        {editorMode ? (
          <ShipmentEditor
            mode={editorMode}
            shipment={editorMode === "edit" ? selected : null}
            locationOptions={locationOptions}
            routeOptions={routeOptions}
            busy={busyAction === "create" || busyAction === "update"}
            error={editorError}
            onCancel={closeEditor}
            onSubmit={(draft) => void saveShipment(editorMode, draft)}
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

  async function saveShipment(mode: Exclude<EditorMode, null>, draft: ShipmentDraft) {
    if (!canManage || activeOperation.current || (mode === "edit" && !selected)) return;
    const action = mode === "create" ? "create" : "update";
    activeOperation.current = action;
    setBusyAction(action);
    setEditorError("");
    try {
      const [shipper, consignee] = await Promise.all([
        resolvePartyReference(host.token, draft.shipperPartyId, host.onUnauthorized),
        resolvePartyReference(host.token, draft.consigneePartyId, host.onUnauthorized),
      ]);
      if (shipper.status !== "ready") throw new Error(`Shipper Party: ${shipper.status_summary}`);
      if (consignee.status !== "ready") throw new Error(`Consignee Party: ${consignee.status_summary}`);
      const shipment = mode === "create"
        ? await createShipment(host.token, draft, host.onUnauthorized)
        : await updateShipment(host.token, selected!, draft, host.onUnauthorized);
      applyMutation(action, shipment);
    } catch (error) {
      const message = errorMessage(error);
      setEditorError(message);
      setStatus(message);
    } finally {
      activeOperation.current = "";
      setBusyAction("");
    }
  }

  async function runTransition(shipment: Shipment, newStatus: ShipmentStatus, reason: string) {
    if (!canManage || activeOperation.current) return;
    activeOperation.current = "transition";
    setBusyAction("transition");
    try {
      const changed = await transitionShipmentStatus(host.token, shipment, newStatus, reason, host.onUnauthorized);
      applyMutation("transition", changed);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      activeOperation.current = "";
      setBusyAction("");
    }
  }

  function applyMutation(action: string, shipment: Shipment) {
    setShipments((current) => [shipment, ...current.filter((row) => row.id !== shipment.id)]);
    setSelectedId(shipment.id);
    setDetail(shipment);
    setEditorMode(null);
    setStatus(`${actionLabel(action)} ${shipment.code}.`);
    void host.refreshHost().catch(() => undefined);
  }
}

function actionLabel(action: string) {
  return ({ create: "Created", update: "Updated", transition: "Changed status for" } as Record<string, string>)[action] || "Changed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Shipment Support request failed.";
}
