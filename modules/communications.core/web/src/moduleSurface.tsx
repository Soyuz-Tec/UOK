import { MessageCircleMore } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";

import { CommunicationsWorkspace } from "./CommunicationsWorkspace";
import { COMMUNICATIONS_MODULE_ID, COMMUNICATIONS_SECTION_ID } from "./communicationsModule";
import "./styles/index.css";

export const communicationsModuleSurface: ModuleSurface = {
  id: COMMUNICATIONS_SECTION_ID,
  label: "K Connect",
  icon: MessageCircleMore,
  moduleName: COMMUNICATIONS_MODULE_ID,
  order: 50,
  render: (host) => (
    <CommunicationsWorkspace
      token={host.token}
      moduleRows={[...host.moduleRows]}
      busyAction={host.busyAction}
      onInstall={() => void host.moduleAction(COMMUNICATIONS_MODULE_ID, "install")}
    />
  )
};

export default communicationsModuleSurface;
