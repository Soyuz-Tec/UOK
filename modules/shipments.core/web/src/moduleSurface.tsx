import { Ship } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { ShipmentSupportWorkspace } from "./ShipmentSupportWorkspace";
import { SHIPMENT_MODULE_ID, SHIPMENT_SECTION_ID } from "./shipmentModule";
import "./styles/index.css";
import "./styles/documentRequirements.css";
import "./styles/documentInstances.css";

export const shipmentSupportModuleSurface: ModuleSurface = {
  id: SHIPMENT_SECTION_ID,
  label: "Shipment Support",
  icon: Ship,
  moduleName: SHIPMENT_MODULE_ID,
  order: 39,
  render: (host) => (
    <ShipmentSupportWorkspace
      key={`${host.session.token}:${host.currentUserRole}`}
      host={host}
    />
  ),
};

export default shipmentSupportModuleSurface;
