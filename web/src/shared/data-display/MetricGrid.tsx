import { EmptyState } from "./EmptyState";

export function MetricGrid({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  return (
    <div className="metric-grid">
      {entries.length ? entries.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label.replace(/_/g, " ")}</span>
          <strong>{value}</strong>
        </div>
      )) : <EmptyState text="No counts loaded." />}
    </div>
  );
}
