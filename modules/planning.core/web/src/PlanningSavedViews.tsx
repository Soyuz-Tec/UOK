import { SavedViewControls } from "@uok/shared/forms";
import { createPlanningSavedView, planningConfigFromSavedView, type PlanningSavedViewConfig } from "./planningViewPersistence";

export function PlanningSavedViews({
  current,
  onApply,
}: {
  current: PlanningSavedViewConfig;
  onApply: (config: PlanningSavedViewConfig) => void;
}) {
  return (
    <SavedViewControls
      createView={(name) => createPlanningSavedView(name, current)}
      label="Saved planning views"
      nameLabel="Planning view name"
      storageKey="planning.gantt.savedViews"
      onApply={(view) => onApply(planningConfigFromSavedView(view, current))}
    />
  );
}
