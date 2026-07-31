import { CalendarDays } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";

import { CalendarWorkspace } from "./CalendarWorkspace";
import { CALENDAR_MODULE_ID, CALENDAR_SECTION_ID } from "./calendarModule";
import "./styles/index.css";

export const calendarModuleSurface: ModuleSurface = {
  id: CALENDAR_SECTION_ID,
  label: "Calendar",
  icon: CalendarDays,
  moduleName: CALENDAR_MODULE_ID,
  order: 40,
  render: (host) => (
    <CalendarWorkspace
      token={host.session.token}
      moduleRows={[...host.moduleRows]}
      busyAction={host.busyAction}
      onInstall={() => void host.moduleAction(CALENDAR_MODULE_ID, "install")}
    />
  )
};

export default calendarModuleSurface;
