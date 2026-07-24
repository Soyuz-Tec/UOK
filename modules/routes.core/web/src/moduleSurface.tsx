import { Route as RouteIcon } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { RouteMasterWorkspace } from "./RouteMasterWorkspace";
import { ROUTE_MODULE_ID, ROUTE_SECTION_ID } from "./routeModule";
import "./styles/index.css";

export const routeMasterModuleSurface: ModuleSurface = {
  id: ROUTE_SECTION_ID,
  label: "Route/Corridor Master",
  icon: RouteIcon,
  moduleName: ROUTE_MODULE_ID,
  order: 38,
  render: (host) => <RouteMasterWorkspace host={host} />,
};

export default routeMasterModuleSurface;
