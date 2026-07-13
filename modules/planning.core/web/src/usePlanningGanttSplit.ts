import { useCallback, useState } from "react";

import type { FieldPreset } from "./planningTimelineModel";
import { planningSplitStorageKey, readPlanningSplitPercent, writePlanningSplitPercent } from "./planningGanttSplitModel";

export function usePlanningGanttSplit(projectId: string, fieldPreset: FieldPreset) {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const key = planningSplitStorageKey(projectId, fieldPreset);
  const splitPercent = positions[key] ?? readPlanningSplitPercent(projectId, fieldPreset);

  const setSplitPercent = useCallback((value: number) => {
    const next = writePlanningSplitPercent(projectId, fieldPreset, value);
    setPositions((current) => ({ ...current, [key]: next }));
  }, [fieldPreset, key, projectId]);

  const setSplitPercentForPreset = useCallback((preset: FieldPreset, value: number) => {
    const presetKey = planningSplitStorageKey(projectId, preset);
    const next = writePlanningSplitPercent(projectId, preset, value);
    setPositions((current) => ({ ...current, [presetKey]: next }));
  }, [projectId]);

  return { splitPercent, setSplitPercent, setSplitPercentForPreset };
}
