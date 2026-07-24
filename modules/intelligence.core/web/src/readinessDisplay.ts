import type {
  ShipmentReadinessBand,
  ShipmentReadinessReasonCode,
  ShipmentReadinessSignal,
} from "./types";

type Translate = (key: string, fallback?: string) => string;

export function readinessBandLabel(
  band: ShipmentReadinessBand,
  t: Translate,
) {
  const fallback = {
    attention_required: "Attention required",
    not_assessed: "Not assessed",
    ready: "Ready",
  }[band];
  return t(`intelligence.band.${band}`, fallback);
}

export function readinessBandTone(band: ShipmentReadinessBand) {
  if (band === "ready") return "success" as const;
  if (band === "attention_required") return "danger" as const;
  return "warning" as const;
}

export function lifecycleLabel(value: string, t: Translate) {
  const fallback = value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return t(`intelligence.lifecycle.${value}`, fallback);
}

export function reasonLabel(
  code: ShipmentReadinessReasonCode,
  t: Translate,
) {
  const fallback = {
    required_documents_missing: "Required document types are still missing.",
    rejected_document_present: "Rejected document metadata needs review.",
    requirements_not_defined: "Required document types have not been defined.",
    required_documents_satisfied: "All required document types are satisfied.",
    document_metadata_pending_review: "Document metadata is awaiting verification.",
    verified_document_present: "Verified document metadata is present.",
  }[code];
  return t(`intelligence.reason.${code}`, fallback);
}

export function readinessSummary(
  signal: ShipmentReadinessSignal,
  t: Translate,
  formatNumber: (value: number) => string,
) {
  if (signal.band === "attention_required") {
    return t(
      "intelligence.summary.attention",
      "Shipment needs attention: {missing} required document(s) missing and "
        + "{rejected} rejected document record(s).",
    )
      .replace("{missing}", formatNumber(signal.required_missing))
      .replace("{rejected}", formatNumber(signal.document_instance_rejected));
  }
  if (signal.band === "not_assessed") {
    return t(
      "intelligence.summary.notAssessed",
      "Shipment readiness is not assessed because no required document types are defined.",
    );
  }
  return t(
    "intelligence.summary.ready",
    "Shipment required document metadata is satisfied.",
  );
}

export function safeShipmentOpenPath(path: string | null) {
  if (!path || /[\u0000-\u001f\\]/.test(path)) return null;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname !== "/" || url.searchParams.get("view") !== "shipments") return null;
    if (!url.searchParams.get("shipment_id")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
