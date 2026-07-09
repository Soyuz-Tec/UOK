import type { CSSProperties, ElementType } from "react";

type SegmentStyle = CSSProperties & { "--uok-segment-count": string };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  iconOnly = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string; icon: ElementType }>;
  label: string;
  iconOnly?: boolean;
}) {
  const segmentStyle: SegmentStyle = { "--uok-segment-count": String(options.length) };

  return (
    <div
      className={iconOnly ? "segmented-control icon-only" : "segmented-control"}
      role="group"
      aria-label={label}
      style={segmentStyle}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            className={value === option.id ? "segment selected" : "segment"}
            aria-label={iconOnly ? option.label : undefined}
            aria-pressed={value === option.id}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span className={iconOnly ? "visually-hidden" : undefined}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
