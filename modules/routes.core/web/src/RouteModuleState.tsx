import { Download, Power } from "lucide-react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import { ROUTE_MODULE_ID } from "./routeModule";

export function RouteModuleState({ module, host }: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  return (
    <Pane title="Route/Corridor Master" description="Module state" wide>
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line"><h2 className="module-name">routes.core</h2><StatusPill label={module?.status || "available"} tone="info" /></div>
          <p className="module-meta">Tenant-scoped ordered trade corridor definitions</p>
        </div>
        <CommandButton icon={Icon} loading={host.busyAction === `${ROUTE_MODULE_ID}:${action}`} onClick={() => void host.moduleAction(ROUTE_MODULE_ID, action)}>
          {action === "enable" ? "Enable Route/Corridor Master" : "Install Route/Corridor Master"}
        </CommandButton>
      </div>
    </Pane>
  );
}
