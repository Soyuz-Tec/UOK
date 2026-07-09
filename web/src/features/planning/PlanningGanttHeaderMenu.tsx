import { ArrowUpDown, EyeOff, Maximize2, MoreHorizontal, RotateCcw, Rows3 } from "lucide-react";
import { useState, type PointerEvent } from "react";

import { WorkspaceContextMenu, type WorkspaceContextMenuItem } from "../../shared/overlays";
import type { PlanningGridColumn } from "./planningGanttModel";

export function PlanningGanttHeaderMenu({
  column,
  canHide,
  onColumnHide,
  onColumnQuickAction,
  onResetColumns,
  onResetWidth,
  onSort,
}: {
  column: PlanningGridColumn;
  canHide: boolean;
  onColumnHide: (columnId: string) => void;
  onColumnQuickAction: (column: PlanningGridColumn) => void;
  onResetColumns: () => void;
  onResetWidth: (columnId: string) => void;
  onSort: (columnId: string) => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const quickLabel = column.id === "task" ? "Toggle row density" : "Auto-fit column";
  const quickDescription = column.id === "task" ? "Compact or restore visible rows" : "Fit visible content";

  return (
    <>
      <button
        type="button"
        className="planning-owned-header-menu-trigger"
        aria-label={`Column menu for ${column.label}`}
        aria-expanded={Boolean(position)}
        draggable={false}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({ x: rect.left, y: rect.bottom + 4 });
        }}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
      >
        <MoreHorizontal size={13} aria-hidden="true" />
      </button>
      <WorkspaceContextMenu label={`Column actions for ${column.label}`} open={Boolean(position)} position={position || { x: 0, y: 0 }} onClose={() => setPosition(null)} items={menuItems()} />
    </>
  );

  function menuItems(): WorkspaceContextMenuItem[] {
    return [
      item("sort", "Sort by column", "Order visible rows", ArrowUpDown, () => onSort(column.id)),
      item("quick", quickLabel, quickDescription, column.id === "task" ? Rows3 : Maximize2, () => onColumnQuickAction(column)),
      item("reset-width", "Reset width", "Restore default column width", RotateCcw, () => onResetWidth(column.id)),
      item("hide", "Hide column", "Remove from current field view", EyeOff, () => onColumnHide(column.id), !canHide),
      item("show-all", "Show all columns", "Reset visible field choices", RotateCcw, onResetColumns),
    ];
  }
}

function item(id: string, label: string, description: string, icon: WorkspaceContextMenuItem["icon"], onSelect: () => void, disabled = false): WorkspaceContextMenuItem {
  return { id, label, description, icon, disabled, onSelect };
}
