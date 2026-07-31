import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

type PlanningErrorStatus = {
  status: "error";
  http_status: number;
  code: string;
  message: string;
  field: string | null;
  object_ids: string[];
  repair: string;
  current_revision: number | null;
  correlation_id: string | null;
};

export function PlanningErrorNotice({ status }: { status: unknown }) {
  const error = planningErrorStatus(status);
  const noticeRef = useRef<HTMLElement>(null);
  const hasError = error !== null;
  const errorCode = error?.code;
  const errorCorrelationId = error?.correlation_id;

  useEffect(() => {
    if (hasError) noticeRef.current?.focus();
  }, [errorCode, errorCorrelationId, hasError]);

  if (!error) return null;
  return (
    <section
      ref={noticeRef}
      className="planning-concurrency-notice planning-error-notice"
      role="alert"
      aria-live="assertive"
      aria-label="Planning change failed"
      tabIndex={-1}
    >
      <TriangleAlert size={20} aria-hidden="true" />
      <div className="planning-concurrency-copy">
        <strong>Planning change was not applied</strong>
        <span>{error.message}</span>
        <span>{error.repair}</span>
        <small>
          {error.field ? `Field: ${error.field}. ` : ""}
          {error.current_revision ? `Current revision: ${error.current_revision}. ` : ""}
          {error.correlation_id ? `Audit reference: ${error.correlation_id}.` : ""}
        </small>
      </div>
    </section>
  );
}

export function planningErrorStatus(value: unknown): PlanningErrorStatus | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.status !== "error" || typeof row.http_status !== "number" || typeof row.code !== "string"
    || typeof row.message !== "string" || typeof row.repair !== "string" || !Array.isArray(row.object_ids)) return null;
  return {
    status: "error",
    http_status: row.http_status,
    code: row.code,
    message: row.message,
    field: typeof row.field === "string" ? row.field : null,
    object_ids: row.object_ids.filter((item): item is string => typeof item === "string"),
    repair: row.repair,
    current_revision: typeof row.current_revision === "number" ? row.current_revision : null,
    correlation_id: typeof row.correlation_id === "string" ? row.correlation_id : null,
  };
}
