import { Columns3, RotateCcw } from "lucide-react";
import { useId, useState } from "react";

import type { ColumnVisibilityMap, ColumnVisibilityOption } from "./columnVisibility";

export type FieldVisibilityMenuConfig = {
  groupLabel?: string;
  label?: string;
  options: ColumnVisibilityOption[];
  resetLabel?: string;
  visibility: ColumnVisibilityMap;
  onReset: () => void;
  onToggle: (fieldId: string, visible: boolean) => void;
};

export function FieldVisibilityMenu({
  groupLabel = "Visible fields",
  label = "Fields",
  options,
  resetLabel = "Reset fields",
  visibility,
  onReset,
  onToggle
}: FieldVisibilityMenuConfig) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="field-visibility-menu">
      <button
        type="button"
        className="field-visibility-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Columns3 size={16} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open ? (
        <div id={panelId} className="field-visibility-panel" role="group" aria-label={groupLabel}>
          <div className="field-visibility-options">
            {options.map((option) => (
              <label key={option.id} className="field-visibility-option">
                <input
                  type="checkbox"
                  checked={option.locked || visibility[option.id] !== false}
                  disabled={option.locked}
                  onChange={(event) => onToggle(option.id, event.currentTarget.checked)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <button type="button" className="field-visibility-reset" onClick={onReset}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>{resetLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
