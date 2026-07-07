import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "info" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <span className={`status-pill ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
