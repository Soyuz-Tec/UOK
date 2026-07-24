import { Download, Power } from "lucide-react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import { COMPLIANCE_MODULE_ID } from "./complianceModule";

export function ComplianceModuleState({ module, host }: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  return (
    <Pane title="Compliance Document Types" description="Module state" wide>
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line">
            <h2 className="module-name">compliance.core</h2>
            <StatusPill label={module?.status || "available"} tone="info" />
          </div>
          <p className="module-meta">Tenant-scoped vocabulary for compliance document types</p>
        </div>
        <CommandButton
          icon={Icon}
          loading={host.busyAction === `${COMPLIANCE_MODULE_ID}:${action}`}
          onClick={() => void host.moduleAction(COMPLIANCE_MODULE_ID, action)}
        >
          {action === "enable"
            ? "Enable Compliance Document Types"
            : "Install Compliance Document Types"}
        </CommandButton>
      </div>
    </Pane>
  );
}
