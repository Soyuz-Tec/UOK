import type { LucideIcon } from "lucide-react";

export type RecordFactListItem = {
  id: string;
  label: string;
  value: string;
  icon?: LucideIcon;
};

export function RecordFactList({
  items,
  compact = false,
  emptyText = "No details recorded."
}: {
  items: RecordFactListItem[];
  compact?: boolean;
  emptyText?: string;
}) {
  if (!items.length) {
    return <p className="record-fact-empty">{emptyText}</p>;
  }

  return (
    <div className={compact ? "record-fact-list compact" : "record-fact-list"}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className="record-fact-row" key={item.id}>
            {Icon ? (
              <span className="record-fact-icon" aria-hidden="true">
                <Icon size={compact ? 14 : 18} />
              </span>
            ) : null}
            <span className="record-fact-copy">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}
