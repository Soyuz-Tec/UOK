import { AlertCircle, CheckCircle2 } from "lucide-react";

export function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`status-row ${ok ? "passed" : "pending"}`}>
      {ok ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
      <span>{label}</span>
      <strong>{ok ? "Passed" : "Pending"}</strong>
    </div>
  );
}
