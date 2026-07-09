import { Bookmark, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useSavedSearchViews } from "../../shared/forms/useSavedSearchViews";
import { CommandButton } from "../../shared/primitives";
import { createPlanningSavedView, planningConfigFromSavedView, type PlanningSavedViewConfig } from "./planningViewPersistence";

export function PlanningSavedViews({
  current,
  onApply,
}: {
  current: PlanningSavedViewConfig;
  onApply: (config: PlanningSavedViewConfig) => void;
}) {
  const { deleteSavedView, savedViews, upsertSavedView } = useSavedSearchViews("planning.gantt.savedViews");
  const [name, setName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const selectedView = useMemo(() => savedViews.find((view) => view.id === selectedViewId), [savedViews, selectedViewId]);

  return (
    <div className="planning-saved-views" aria-label="Saved planning views">
      <Bookmark size={16} aria-hidden="true" />
      <label>
        <span>Saved view</span>
        <select
          aria-label="Saved planning view"
          value={selectedViewId}
          onChange={(event) => {
            const view = savedViews.find((item) => item.id === event.target.value);
            setSelectedViewId(event.target.value);
            if (view) onApply(planningConfigFromSavedView(view, current));
          }}
        >
          <option value="">{savedViews.length ? "Select view" : "No saved views"}</option>
          {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      </label>
      <input
        aria-label="Planning view name"
        value={name}
        placeholder="View name"
        onChange={(event) => setName(event.target.value)}
      />
      <CommandButton
        icon={Save}
        disabled={!name.trim()}
        onClick={() => {
          const view = createPlanningSavedView(name, current);
          upsertSavedView(view);
          setSelectedViewId(view.id);
          setName("");
        }}
      >
        Save view
      </CommandButton>
      <CommandButton
        icon={Trash2}
        disabled={!selectedView}
        onClick={() => {
          if (!selectedView) return;
          deleteSavedView(selectedView.id);
          setSelectedViewId("");
        }}
      >
        Delete
      </CommandButton>
    </div>
  );
}
