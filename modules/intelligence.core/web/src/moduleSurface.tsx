import { ScanSearch } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import {
  INTELLIGENCE_MODULE_ID,
  INTELLIGENCE_SECTION_ID,
} from "./intelligenceModule";
import { ShipmentReadinessWorkspace } from "./ShipmentReadinessWorkspace";
import "./styles/index.css";

export const shipmentReadinessModuleSurface: ModuleSurface = {
  id: INTELLIGENCE_SECTION_ID,
  label: "Shipment Readiness",
  icon: ScanSearch,
  moduleName: INTELLIGENCE_MODULE_ID,
  order: 45,
  render: (host) => (
    <ShipmentReadinessWorkspace
      key={`${host.session.token}:${host.currentUserRole}`}
      host={host}
    />
  ),
};

export default shipmentReadinessModuleSurface;
