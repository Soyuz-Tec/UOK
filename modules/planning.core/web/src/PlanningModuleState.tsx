import { Plus } from "lucide-react";

import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import { PLANNING_MODULE_ID } from "./planningModule";
import type { PlanningWorkspaceProps } from "./types";

const PLANNING_DEPENDENCY_FALLBACK = ["calendar.core"];

function isOperational(status: string | undefined) {
  return status === "installed" || status === "upgraded";
}

export function PlanningModuleState({ module, moduleRows, busyAction, onActivate }: Pick<PlanningWorkspaceProps, "module" | "moduleRows" | "busyAction" | "onActivate">) {
  const dependencies = module?.dependencies.length ? module.dependencies : PLANNING_DEPENDENCY_FALLBACK;
  const blockedDependencyName = dependencies.find((dependency) => (
    !isOperational(moduleRows.find((row) => row.name === dependency)?.status)
  ));
  const blockedDependency = moduleRows.find((row) => row.name === blockedDependencyName);
  const action = module?.status === "disabled" ? "Enable" : "Install";
  const targetModule = blockedDependencyName || PLANNING_MODULE_ID;
  const targetAction = blockedDependencyName
    ? blockedDependency?.status === "disabled" ? "enable" : "install"
    : module?.status === "disabled" ? "enable" : "install";
  const dependencyAction = blockedDependency?.status === "disabled" ? "Enable" : "Install";
  return (
    <section className="planning-workspace" aria-label="Planning">
      <Pane title="Planning" description="Module state" wide>
        <div className="module-row">
          <div className="module-main">
            <div className="module-title-line">
              <h2 className="module-name">{PLANNING_MODULE_ID}</h2>
              <StatusPill label={module?.status || "available"} tone="info" />
            </div>
            <p className="module-meta">capability_module - {module?.version || "not loaded"}</p>
            {blockedDependencyName ? (
              <p className="module-meta">Requires {blockedDependencyName} availability before Planning can be installed.</p>
            ) : null}
          </div>
          <div className="module-actions">
            <CommandButton icon={Plus} onClick={() => onActivate(targetModule, targetAction)} loading={busyAction.startsWith(targetModule)}>
              {blockedDependencyName ? `${dependencyAction} ${blockedDependencyName}` : action}
            </CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}
