import { Download, Power } from "lucide-react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import { INTELLIGENCE_MODULE_ID } from "./intelligenceModule";

export function IntelligenceModuleState({
  module,
  host,
}: {
  module: ModuleSurfaceHostContext["moduleRows"][number] | undefined;
  host: ModuleSurfaceHostContext;
}) {
  const { t } = useUokLocalization();
  const action = module?.status === "disabled" ? "enable" : "install";
  const Icon = action === "enable" ? Power : Download;
  const canManageModules = host.currentUserRole === "platform_admin";
  const status = module?.status || "available";
  return (
    <Pane
      title={t("intelligence.title", "Shipment Readiness")}
      description={t("intelligence.moduleState", "Module state")}
      wide
    >
      <div className="module-row">
        <div className="module-main">
          <div className="module-title-line">
            <h2 className="module-name">intelligence.core</h2>
            <StatusPill
              label={t(
                `intelligence.module.status.${status}`,
                status,
              )}
              tone="info"
            />
          </div>
          <p className="module-meta">
            {t(
              "intelligence.moduleDescription",
              "Read-only tenant-scoped Shipment readiness signals",
            )}
          </p>
        </div>
        {canManageModules ? (
          <CommandButton
            icon={Icon}
            loading={host.busyAction === `${INTELLIGENCE_MODULE_ID}:${action}`}
            onClick={() => void host.moduleAction(INTELLIGENCE_MODULE_ID, action)}
          >
            {t(
              `intelligence.module.${action}`,
              action === "enable"
                ? "Enable Shipment Readiness"
                : "Install Shipment Readiness",
            )}
          </CommandButton>
        ) : (
          <p className="module-meta">
            {t(
              `intelligence.module.${action}Required`,
              `A platform administrator must ${action} this module.`,
            )}
          </p>
        )}
      </div>
    </Pane>
  );
}
