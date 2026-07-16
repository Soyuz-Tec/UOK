import { Download, Power } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { Pane, WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { ProductDetail } from "./ProductDetail";
import { ProductEditor } from "./ProductEditor";
import { ProductTable } from "./ProductTable";
import {
  archiveProductDefinition,
  createProductDefinition,
  loadProductDefinitions,
  loadProductNameHistory,
  restoreProductDefinition,
  updateProductDefinition,
} from "./productApi";
import { filterAndSortProducts } from "./productFilters";
import { PRODUCT_MASTER_MODULE_ID } from "./productModule";
import type {
  ProductDefinition,
  ProductDraft,
  ProductNameHistory,
  ProductSort,
  ProductSortDirection,
  ProductStatus,
} from "./types";

type EditorMode = "create" | "edit" | null;

export function ProductMasterWorkspace({ host }: { host: ModuleSurfaceHostContext }) {
  const module = host.moduleRows.find((row) => row.name === PRODUCT_MASTER_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const canManage = ["platform_admin", "ops_manager", "trader"].includes(host.currentUserRole);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<ProductNameHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("active");
  const [sortBy, setSortBy] = useState<ProductSort>("code");
  const [sortDirection, setSortDirection] = useState<ProductSortDirection>("asc");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("Product Master ready.");
  const activeOperation = useRef("");
  const selected = products.find((product) => product.id === selectedId) || null;
  const visibleProducts = useMemo(() => filterAndSortProducts(products, {
    query,
    status: statusFilter,
    sortBy,
    sortDirection,
  }), [products, query, sortBy, sortDirection, statusFilter]);

  const refreshProducts = useCallback(async () => {
    if (!host.token || !operational) return;
    try {
      setBusyAction("refresh");
      const rows = await loadProductDefinitions(host.token, host.onUnauthorized);
      setProducts(rows);
      setSelectedId((current) => rows.some((product) => product.id === current)
        ? current
        : rows.find((product) => product.status === "active")?.id || rows[0]?.id || "");
      setStatus(`${rows.length} product definition(s) loaded.`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusyAction("");
    }
  }, [host.onUnauthorized, host.token, operational]);

  useEffect(() => {
    if (!host.token || !operational) {
      setProducts([]);
      setSelectedId("");
      setHistory([]);
      setEditorMode(null);
      return;
    }
    void refreshProducts();
  }, [host.moduleRefreshRevision, host.token, operational, refreshProducts]);

  useEffect(() => {
    if (!host.token || !operational || !selected) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void loadProductNameHistory(host.token, selected.id, host.onUnauthorized)
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

  if (!host.token) return <EmptyState text="Sign in to open Product Master." />;
  if (!operational) return <ProductModuleState module={module} host={host} />;

  return (
    <section className="product-master-workspace" aria-label="Product Master">
      <WorkspaceCommandBar
        label="Product Master controls"
        query={(
          <SearchWorkspace
            label="Search product definitions"
            value={query}
            placeholder="Search products"
            defaultSummaryLabel="Active products"
            filters={[{
              id: "status",
              label: "Status",
              value: statusFilter,
              defaultValue: "active",
              options: statusOptions,
              onChange: (value) => setStatusFilter(value as "all" | ProductStatus),
            }]}
            sort={{
              label: "Product sort field",
              value: sortBy,
              defaultValue: "code",
              options: [{ value: "code", label: "Code" }, { value: "name", label: "Name" }],
              direction: sortDirection,
              defaultDirection: "asc",
              onChange: (value) => setSortBy(value as ProductSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_product_master_saved_search_views"
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
          onSelect: () => void refreshProducts(),
        }]} />}
        primaryAction={canManage ? <WorkspaceActionButton action="create" labelKey="command.newProduct" fallbackLabel="New product" primary disabled={Boolean(busyAction)} onClick={openCreate} /> : null}
      />
      <p className="product-master-status" role="status">{status}</p>
      <WorkflowSplitView
        primaryLabel="Product definitions"
        secondaryLabel="Product details"
        primary={<ProductTable products={visibleProducts} selectedId={selectedId} onSelect={setSelectedId} />}
        secondary={(
          <ProductDetail
            product={selected}
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
        label={editorMode === "create" ? "Create product definition" : "Edit product definition"}
        title={editorMode === "create" ? "New product" : "Edit product"}
        description="Govern canonical product identity without creating cargo or transaction records."
        dismissible={!activeOperation.current}
        onClose={closeEditor}
      >
        {editorMode ? (
          <ProductEditor
            mode={editorMode}
            product={editorMode === "edit" ? selected : null}
            busy={busyAction === "create" || busyAction === "update"}
            error={editorError}
            onCancel={closeEditor}
            onSubmit={(draft) => void saveProduct(editorMode, draft)}
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

  async function saveProduct(mode: Exclude<EditorMode, null>, draft: ProductDraft) {
    if (!canManage || activeOperation.current || (mode === "edit" && !selected)) return;
    const action = mode === "create" ? "create" : "update";
    await runMutation(action, async () => mode === "create"
      ? createProductDefinition(host.token, draft, host.onUnauthorized)
      : updateProductDefinition(host.token, selected!, draft, host.onUnauthorized));
  }

  async function runLifecycle(action: "archive" | "restore", product: ProductDefinition) {
    if (!canManage || activeOperation.current) return;
    await runMutation(action, () => action === "archive"
      ? archiveProductDefinition(host.token, product, host.onUnauthorized)
      : restoreProductDefinition(host.token, product, host.onUnauthorized));
    setStatusFilter(action === "archive" ? "all" : "active");
  }

  async function runMutation(action: string, operation: () => Promise<ProductDefinition>) {
    activeOperation.current = action;
    setBusyAction(action);
    setEditorError("");
    try {
      const product = await operation();
      setProducts((current) => [product, ...current.filter((row) => row.id !== product.id)]);
      setSelectedId(product.id);
      setEditorMode(null);
      setStatus(`${actionLabel(action)} ${product.canonical_name}.`);
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

function ProductModuleState({ module, host }: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  return (
    <Pane title="Product Master" description="Module state" wide>
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line"><h2 className="module-name">product.master</h2><StatusPill label={module?.status || "available"} tone="info" /></div>
          <p className="module-meta">Canonical tenant-scoped product definitions</p>
        </div>
        <CommandButton icon={Icon} loading={host.busyAction === `${PRODUCT_MASTER_MODULE_ID}:${action}`} onClick={() => void host.moduleAction(PRODUCT_MASTER_MODULE_ID, action)}>{action === "enable" ? "Enable Product Master" : "Install Product Master"}</CommandButton>
      </div>
    </Pane>
  );
}

const statusOptions = [
  { value: "active", label: "Active products" },
  { value: "all", label: "All products" },
  { value: "archived", label: "Archived products" },
];

function actionLabel(action: string) {
  return ({ create: "Created", update: "Updated", archive: "Archived", restore: "Restored" } as Record<string, string>)[action] || "Changed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Product Master request failed.";
}
