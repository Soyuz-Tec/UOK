import { Download, FileCheck2, Power, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { Pane, WorkspaceCommandBar } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import type { ModuleAction, ModuleStatus } from "@uok/shared/types";

type AppsSort = "name" | "status";
type AppsSortDirection = "asc" | "desc";
type AppsGrouping = "none" | "status" | "maturity";

export function AppsManagerPanel({ modules, busyAction, onAction }: {
  modules: ModuleStatus[];
  busyAction: string;
  onAction: (moduleName: string, action: ModuleAction) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [maturityFilter, setMaturityFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sortBy, setSortBy] = useState<AppsSort>("name");
  const [sortDirection, setSortDirection] = useState<AppsSortDirection>("asc");
  const [groupBy, setGroupBy] = useState<AppsGrouping>("none");
  const visibleModules = useMemo(() => filterAndSortModules(modules, {
    kindFilter,
    maturityFilter,
    query,
    sortBy,
    sortDirection,
    statusFilter,
  }), [kindFilter, maturityFilter, modules, query, sortBy, sortDirection, statusFilter]);
  const groupedModules = useMemo(() => groupModules(visibleModules, groupBy), [groupBy, visibleModules]);

  return (
    <section className="apps-manager-workspace" aria-label="Apps Manager">
      <WorkspaceCommandBar
        label="Apps Manager controls"
        query={(
          <SearchWorkspace
            label="Search modules"
            value={query}
            placeholder="Search modules"
            defaultSummaryLabel="All modules"
            filters={[
              { id: "status", label: "Status", value: statusFilter, defaultValue: "all", options: moduleOptions(modules, "status", "All statuses"), onChange: setStatusFilter },
              { id: "maturity", label: "Maturity", value: maturityFilter, defaultValue: "all", options: moduleOptions(modules, "maturity", "All maturities"), onChange: setMaturityFilter },
              { id: "kind", label: "Kind", value: kindFilter, defaultValue: "all", options: moduleOptions(modules, "kind", "All kinds"), onChange: setKindFilter },
            ]}
            sort={{
              label: "Module sort field",
              value: sortBy,
              defaultValue: "name",
              options: [{ value: "name", label: "Name" }, { value: "status", label: "Status" }],
              direction: sortDirection,
              defaultDirection: "asc",
              onChange: (value) => setSortBy(value as AppsSort),
              onDirectionChange: setSortDirection,
            }}
            groupBy={groupBy}
            groupOptions={[
              { value: "none", label: "No grouping" },
              { value: "status", label: "Status" },
              { value: "maturity", label: "Maturity" },
            ]}
            savedViewsStorageKey="uok_apps_manager_saved_search_views"
            onChange={setQuery}
            onGroupByChange={(value) => setGroupBy(value as AppsGrouping)}
            onClear={() => {
              setQuery("");
              setStatusFilter("all");
              setMaturityFilter("all");
              setKindFilter("all");
            }}
          />
        )}
      />
      <Pane description={`${visibleModules.length} of ${modules.length} modules`} wide>
        <div className="module-list" role="list" aria-label="Available modules">
          {visibleModules.length ? groupedModules.map((group) => (
            <div className="apps-module-group" role="listitem" key={group.key}>
              {groupBy !== "none" ? <h2 className="apps-module-group-heading">{group.label}</h2> : null}
              <div className="apps-module-group-list" role="list" aria-label={group.label}>
                {group.modules.map((module) => (
                  <ModuleRow key={module.name} module={module} busyAction={busyAction} onAction={onAction} />
                ))}
              </div>
            </div>
          )) : (
            <div role="listitem">
              <EmptyState text={modules.length ? "No modules match the current search." : "No module records found."} />
            </div>
          )}
        </div>
      </Pane>
    </section>
  );
}

function filterAndSortModules(modules: ModuleStatus[], options: {
  kindFilter: string;
  maturityFilter: string;
  query: string;
  sortBy: AppsSort;
  sortDirection: AppsSortDirection;
  statusFilter: string;
}) {
  const normalizedQuery = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return modules
    .filter((module) => {
      if (options.statusFilter !== "all" && module.status !== options.statusFilter) return false;
      if (options.maturityFilter !== "all" && module.maturity !== options.maturityFilter) return false;
      if (options.kindFilter !== "all" && module.kind !== options.kindFilter) return false;
      if (!normalizedQuery) return true;
      return `${module.name} ${module.kind} ${module.status} ${module.maturity}`.toLocaleLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => direction * compareModules(left, right, options.sortBy));
}

function compareModules(left: ModuleStatus, right: ModuleStatus, sortBy: AppsSort) {
  const comparison = sortBy === "status"
    ? left.status.localeCompare(right.status)
    : left.name.localeCompare(right.name);
  return comparison || left.name.localeCompare(right.name);
}

function groupModules(modules: ModuleStatus[], groupBy: AppsGrouping) {
  if (groupBy === "none") return [{ key: "all", label: "All modules", modules }];
  const groups = new Map<string, ModuleStatus[]>();
  for (const module of modules) {
    const key = groupBy === "status" ? module.status : module.maturity;
    groups.set(key, [...(groups.get(key) || []), module]);
  }
  return Array.from(groups, ([key, rows]) => ({ key, label: readableValue(key), modules: rows }));
}

function moduleOptions(modules: ModuleStatus[], field: "status" | "maturity" | "kind", allLabel: string) {
  const values = Array.from(new Set(modules.map((module) => module[field]))).sort();
  return [{ value: "all", label: allLabel }, ...values.map((value) => ({ value, label: readableValue(value) }))];
}

function readableValue(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function ModuleRow({ module, busyAction, onAction }: {
  module: ModuleStatus;
  busyAction: string;
  onAction: (moduleName: string, action: ModuleAction) => void;
}) {
  const isOperational = module.status === "installed" || module.status === "upgraded";
  const isPlanned = module.maturity === "planned" || module.status === "planned";
  const lifecycle = new Set(module.lifecycle);
  const canReconcile = module.reconciliation_required;
  const canInstall = module.installable
    && !isPlanned
    && !module.reconciliation_required
    && ["available", "uninstalled"].includes(module.status)
    && lifecycle.has("installed");
  const canUpgrade = isOperational && module.updatable && !isPlanned && !module.reconciliation_required && lifecycle.has("upgraded");
  const canDisable = isOperational && !module.required && !module.reconciliation_required && lifecycle.has("disabled");
  const canEnable = module.status === "disabled" && !module.reconciliation_required && lifecycle.has("installed");
  const canUninstall = module.uninstallable
    && !module.required
    && !module.reconciliation_required
    && ["installed", "upgraded", "disabled"].includes(module.status)
    && lifecycle.has("uninstalled");
  const tone = isOperational ? "success" : module.status === "disabled" || isPlanned ? "warning" : "info";
  const maturityLabel = module.maturity.replaceAll("_", " ");
  return (
    <article
      className="module-row"
      role="listitem"
      aria-label={`${module.name} ${module.status}, maturity ${maturityLabel}`}
    >
      <div className="module-main">
        <div className="module-title-line">
          <h2 className="module-name">{module.name}</h2>
          <StatusPill label={module.status} tone={tone} />
          <StatusPill label={maturityLabel} tone={isPlanned ? "warning" : "info"} />
          {module.reconciliation_required && <StatusPill label="reconciliation required" tone="warning" />}
          {module.required && <StatusPill label="required" tone="info" />}
        </div>
        <p className="module-meta">
          {module.kind} - {module.version} - Maturity: {module.maturity}
          {module.maintainable ? " - maintainable" : " - maintenance unavailable"}
          {module.reconciliation_required ? ` - Recorded status: ${module.recorded_status ?? "missing"}` : ""}
        </p>
      </div>
      <div className="module-actions" aria-label={`${module.name} actions`}>
        {canReconcile && <CommandButton icon={Wrench} onClick={() => onAction(module.name, "reconcile")} loading={busyAction === `${module.name}:reconcile`}>Reconcile</CommandButton>}
        {canInstall && <CommandButton icon={Download} onClick={() => onAction(module.name, "install")} loading={busyAction === `${module.name}:install`}>Install</CommandButton>}
        {canUpgrade && <CommandButton icon={Wrench} onClick={() => onAction(module.name, "upgrade")} loading={busyAction === `${module.name}:upgrade`}>Upgrade</CommandButton>}
        {canDisable && <CommandButton icon={Power} onClick={() => onAction(module.name, "disable")} loading={busyAction === `${module.name}:disable`}>Disable</CommandButton>}
        {canEnable && <CommandButton icon={Power} onClick={() => onAction(module.name, "enable")} loading={busyAction === `${module.name}:enable`}>Enable</CommandButton>}
        {canUninstall && <CommandButton icon={FileCheck2} onClick={() => onAction(module.name, "uninstall")} loading={busyAction === `${module.name}:uninstall`} destructive>Uninstall</CommandButton>}
      </div>
    </article>
  );
}
