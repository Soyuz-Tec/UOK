import { Plus } from "lucide-react";

import { StatusPill } from "../../shared/data-display";
import { Pane } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import { CALENDAR_MODULE_ID } from "../calendar/calendarModule";
import { PLANNING_MODULE_ID } from "./planningModule";
import type { PlanningWorkspaceProps } from "./types";

export function PlanningModuleState({ module, moduleRows, busyAction, onActivate }: Pick<PlanningWorkspaceProps, "module" | "moduleRows" | "busyAction" | "onActivate">) {
  const calendar = moduleRows.find((row) => row.name === CALENDAR_MODULE_ID);
  const calendarOperational = calendar?.status === "installed" || calendar?.status === "upgraded";
  const action = module?.status === "disabled" ? "Enable" : "Install";
  const targetModule = calendarOperational ? PLANNING_MODULE_ID : CALENDAR_MODULE_ID;
  const targetAction = calendarOperational ? module?.status === "disabled" ? "enable" : "install" : calendar?.status === "disabled" ? "enable" : "install";
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
            {!calendarOperational ? <p className="module-meta">Requires calendar.core availability before Planning can be installed.</p> : null}
          </div>
          <div className="module-actions">
            <CommandButton icon={Plus} onClick={() => onActivate(targetModule, targetAction)} loading={busyAction.startsWith(targetModule)}>
              {calendarOperational ? action : "Install calendar.core"}
            </CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}
