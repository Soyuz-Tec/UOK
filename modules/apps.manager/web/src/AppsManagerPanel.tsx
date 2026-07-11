import { Download, FileCheck2, Power, Wrench } from "lucide-react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import type { ModuleAction, ModuleStatus } from "@uok/shared/types";

export function AppsManagerPanel({ modules, busyAction, onAction }: {
  modules: ModuleStatus[];
  busyAction: string;
  onAction: (moduleName: string, action: ModuleAction) => void;
}) {
  return (
    <section className="content-grid" aria-label="Apps Manager">
      <Pane description="Module catalog" wide>
        <div className="module-list" role="list" aria-label="Available modules">
          {modules.length ? modules.map((module) => (
            <ModuleRow key={module.name} module={module} busyAction={busyAction} onAction={onAction} />
          )) : <EmptyState text="No module records found." />}
        </div>
      </Pane>
    </section>
  );
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
