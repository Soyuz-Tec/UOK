import type { ElementType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function SegmentedControl<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string; icon: ElementType }>;
  label: string;
}) {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            className={value === option.id ? "segment selected" : "segment"}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CommandButton({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  loading = false,
  primary = false,
  destructive = false
}: {
  icon: ElementType;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
  destructive?: boolean;
}) {
  const className = [
    "command-button",
    primary ? "primary" : "",
    destructive ? "destructive" : "",
    loading ? "loading" : ""
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
      <Icon size={16} aria-hidden="true" />
      <span>{loading ? "Working" : children}</span>
    </button>
  );
}

export function Pane({ title, description, children, wide = false }: {
  title?: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const labelId = `${(title || description).replace(/\s+/g, "-").toLowerCase()}-title`;
  return (
    <section className={`pane ${wide ? "wide" : ""}`} aria-labelledby={title ? labelId : undefined} aria-label={title ? undefined : description}>
      {title && (
        <header className="pane-header">
          <div>
            <h2 id={labelId}>{title}</h2>
          </div>
        </header>
      )}
      <div className="pane-body">{children}</div>
    </section>
  );
}

export function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`status-row ${ok ? "passed" : "pending"}`}>
      {ok ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
      <span>{label}</span>
      <strong>{ok ? "Passed" : "Pending"}</strong>
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "info" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <span className={`status-pill ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

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

export function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="json-block">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
