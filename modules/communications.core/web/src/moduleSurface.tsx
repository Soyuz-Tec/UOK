import { lazy } from "react";
import { MessageCircleMore } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";

import { COMMUNICATIONS_MODULE_ID, COMMUNICATIONS_SECTION_ID } from "./communicationsModule";
import "./styles/index.css";

const CommunicationsWorkspace = lazy(() => import("./CommunicationsWorkspace").then((module) => ({ default: module.CommunicationsWorkspace })));

export const communicationsModuleSurface: ModuleSurface = {
  id: COMMUNICATIONS_SECTION_ID,
  label: "K Connect",
  icon: MessageCircleMore,
  moduleName: COMMUNICATIONS_MODULE_ID,
  order: 50,
  render: (host) => (
    <CommunicationsWorkspace
      token={host.session.token}
      moduleRows={[...host.moduleRows]}
      busyAction={host.busyAction}
      onInstall={() => void host.moduleAction(COMMUNICATIONS_MODULE_ID, "install")}
    />
  )
};

export default communicationsModuleSurface;
