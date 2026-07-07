import { Download, FileCheck2, Power, Wrench } from "lucide-react";

import type { ModuleAction, ModuleStatus } from "../../shared/types";
import { EmptyState, StatusPill } from "../../shared/data-display";
import { Pane } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";

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
  const tone = isOperational ? "success" : module.status === "disabled" ? "warning" : "info";
  return (
    <article className="module-row" role="listitem" aria-label={`${module.name} ${module.status}`}>
      <div className="module-main">
        <div className="module-title-line">
          <h2 className="module-name">{module.name}</h2>
          <StatusPill label={module.status} tone={tone} />
          {module.required && <StatusPill label="required" tone="info" />}
        </div>
        <p className="module-meta">{module.kind} - {module.version}</p>
      </div>
      <div className="module-actions" aria-label={`${module.name} actions`}>
        {!isOperational && <CommandButton icon={Download} onClick={() => onAction(module.name, "install")} loading={busyAction === `${module.name}:install`}>Install</CommandButton>}
        {isOperational && module.updatable && <CommandButton icon={Wrench} onClick={() => onAction(module.name, "upgrade")} loading={busyAction === `${module.name}:upgrade`}>Upgrade</CommandButton>}
        {isOperational && !module.required && <CommandButton icon={Power} onClick={() => onAction(module.name, "disable")} loading={busyAction === `${module.name}:disable`}>Disable</CommandButton>}
        {module.status === "disabled" && <CommandButton icon={Power} onClick={() => onAction(module.name, "enable")} loading={busyAction === `${module.name}:enable`}>Enable</CommandButton>}
        {module.uninstallable && module.status !== "available" && <CommandButton icon={FileCheck2} onClick={() => onAction(module.name, "uninstall")} loading={busyAction === `${module.name}:uninstall`} destructive>Uninstall</CommandButton>}
      </div>
    </article>
  );
}
