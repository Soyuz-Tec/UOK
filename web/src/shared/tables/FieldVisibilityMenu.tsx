import { Columns3, RotateCcw } from "lucide-react";

import { ExpandableControlPanel } from "../forms";
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
  return (
    <ExpandableControlPanel
      className="field-visibility-menu"
      label={groupLabel}
      panelClassName="field-visibility-panel"
      triggerIcon={Columns3}
      triggerLabel={label}
      triggerSummary={label}
    >
      <>
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
      </>
    </ExpandableControlPanel>
  );
}
