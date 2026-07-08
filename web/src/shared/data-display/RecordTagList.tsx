import type { LucideIcon } from "lucide-react";

import { IconButton } from "../primitives";

export type RecordTagListItem = {
  id: string;
  label: string;
  tone?: "neutral" | "system";
  removeLabel?: string;
};

export function RecordTagList({
  items,
  onRemove,
  removeIcon,
  emptyText
}: {
  items: RecordTagListItem[];
  onRemove?: (id: string) => void;
  removeIcon?: LucideIcon;
  emptyText?: string;
}) {
  if (!items.length) {
    return emptyText ? <p className="record-tag-empty">{emptyText}</p> : null;
  }

  return (
    <div className="record-tag-list">
      {items.map((item) => (
        <span className={item.tone === "system" ? "record-tag system" : "record-tag"} key={item.id}>
          <span>{item.label}</span>
          {onRemove && removeIcon ? (
            <IconButton
              icon={removeIcon}
              label={item.removeLabel || `Remove ${item.label}`}
              title={item.removeLabel || `Remove ${item.label}`}
              onClick={() => onRemove(item.id)}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}
