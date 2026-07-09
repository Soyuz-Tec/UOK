import { Plus } from "lucide-react";

import { StatusPill } from "../../shared/data-display";
import { Pane } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import { PLANNING_MODULE_ID } from "./planningModule";
import type { PlanningWorkspaceProps } from "./types";

export function PlanningModuleState({ module, busyAction, onActivate }: Pick<PlanningWorkspaceProps, "module" | "busyAction" | "onActivate">) {
  const action = module?.status === "disabled" ? "Enable" : "Install";
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
          </div>
          <div className="module-actions">
            <CommandButton icon={Plus} onClick={onActivate} loading={busyAction.startsWith(PLANNING_MODULE_ID)}>
              {action}
            </CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}
