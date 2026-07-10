import { useEffect, useState } from "react";

import { loadPlanningCapabilities } from "./planningApi";
import type { PlanningCapabilities } from "./types";


export const readOnlyPlanningCapabilities: PlanningCapabilities = {
  read: false,
  edit: false,
  baseline_create: false,
  level: false,
  link: false,
  gate_approve: false,
  admin: false,
  analyze: false,
  analysis_approve: false,
  review_only: true,
};


export function usePlanningCapabilities(token: string, operational: boolean) {
  const [capabilities, setCapabilities] = useState(readOnlyPlanningCapabilities);

  useEffect(() => {
    let active = true;
    if (!token || !operational) {
      setCapabilities(readOnlyPlanningCapabilities);
      return () => { active = false; };
    }
    void loadPlanningCapabilities(token)
      .then((value) => { if (active) setCapabilities(value); })
      .catch(() => { if (active) setCapabilities(readOnlyPlanningCapabilities); });
    return () => { active = false; };
  }, [operational, token]);

  return capabilities;
}
