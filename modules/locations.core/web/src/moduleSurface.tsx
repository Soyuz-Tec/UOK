import { MapPin } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { LocationMasterWorkspace } from "./LocationMasterWorkspace";
import { LOCATION_MODULE_ID, LOCATION_SECTION_ID } from "./locationModule";
import "./styles/index.css";

export const locationMasterModuleSurface: ModuleSurface = {
  id: LOCATION_SECTION_ID,
  label: "Location Master",
  icon: MapPin,
  moduleName: LOCATION_MODULE_ID,
  order: 37,
  render: (host) => <LocationMasterWorkspace host={host} />,
};

export default locationMasterModuleSurface;
