import { Bookmark, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandButton } from "../primitives";
import type { SavedSearchView } from "./SearchWorkspace.types";
import { useSavedSearchViews } from "./useSavedSearchViews";

export function SavedViewControls({
  createView,
  label,
  nameLabel,
  onApply,
  storageKey,
}: {
  createView: (name: string) => SavedSearchView;
  label: string;
  nameLabel: string;
  onApply: (view: SavedSearchView) => void;
  storageKey: string;
}) {
  const { deleteSavedView, savedViews, upsertSavedView } = useSavedSearchViews(storageKey);
  const [name, setName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const selectedView = useMemo(() => savedViews.find((view) => view.id === selectedViewId), [savedViews, selectedViewId]);

  return (
    <div className="saved-view-controls" aria-label={label}>
      <Bookmark size={16} aria-hidden="true" />
      <label>
        <span>Saved view</span>
        <select
          aria-label="Select saved view"
          value={selectedViewId}
          onChange={(event) => {
            const view = savedViews.find((item) => item.id === event.target.value);
            setSelectedViewId(event.target.value);
            if (view) onApply(view);
          }}
        >
          <option value="">{savedViews.length ? "Select view" : "No saved views"}</option>
          {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      </label>
      <input aria-label={nameLabel} value={name} placeholder="View name" onChange={(event) => setName(event.target.value)} />
      <CommandButton
        icon={Save}
        disabled={!name.trim()}
        onClick={() => {
          const view = createView(name);
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
