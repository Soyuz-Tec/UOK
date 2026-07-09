import { X } from "lucide-react";

import type { SearchWorkspaceChip } from "./SearchWorkspace.types";

export function SearchRefinementChips({ chips }: { chips: SearchWorkspaceChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="search-workspace-chips" aria-label="Active search refinements">
      {chips.map((chip) => (
        <button key={chip.id} type="button" onClick={chip.onRemove}>
          <span>{chip.label}</span>
          <X size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
