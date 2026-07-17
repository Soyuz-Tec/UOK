import { Download, Power } from "lucide-react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import { SHIPMENT_MODULE_ID } from "./shipmentModule";

export function ShipmentModuleState({ module, host }: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  return (
    <Pane title="Shipment Support" description="Module state" wide>
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line"><h2 className="module-name">shipments.core</h2><StatusPill label={module?.status || "available"} tone="info" /></div>
          <p className="module-meta">Tenant-scoped shipment headers and controlled movement lifecycle</p>
        </div>
        <CommandButton icon={Icon} loading={host.busyAction === `${SHIPMENT_MODULE_ID}:${action}`} onClick={() => void host.moduleAction(SHIPMENT_MODULE_ID, action)}>
          {action === "enable" ? "Enable Shipment Support" : "Install Shipment Support"}
        </CommandButton>
      </div>
    </Pane>
  );
}
