import { MessageCircleMore } from "lucide-react";

import type { ModuleSurface } from "@uok/features/modules/moduleSurfaceContract";

import { CommunicationsWorkspace } from "./CommunicationsWorkspace";
import { COMMUNICATIONS_MODULE_ID, COMMUNICATIONS_SECTION_ID } from "./communicationsModule";
import "./styles/index.css";

export const communicationsModuleSurface: ModuleSurface = {
  id: COMMUNICATIONS_SECTION_ID,
  label: "K Connect",
  icon: MessageCircleMore,
  moduleName: COMMUNICATIONS_MODULE_ID,
  order: 50,
  render: (workbench) => (
    <CommunicationsWorkspace
      token={workbench.token}
      moduleRows={workbench.moduleRows}
      busyAction={workbench.busyAction}
      onInstall={() => workbench.moduleAction(COMMUNICATIONS_MODULE_ID, "install")}
    />
  )
};

export default communicationsModuleSurface;
