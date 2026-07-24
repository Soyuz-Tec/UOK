import { FolderOpen } from "lucide-react";
import type { ReactNode } from "react";

import { DetailItem, EmptyState, StatusPill } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import {
  lifecycleLabel,
  readinessBandLabel,
  readinessBandTone,
  readinessSummary,
  reasonLabel,
  safeShipmentOpenPath,
} from "./readinessDisplay";
import type { ShipmentReadinessSignal } from "./types";

export function ShipmentReadinessDetail({
  signal,
}: {
  signal: ShipmentReadinessSignal | null;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  if (!signal) {
    return (
      <EmptyState
        title={t("intelligence.detail.noneTitle", "No Shipment selected")}
        text={t(
          "intelligence.detail.noneText",
          "Select a readiness signal to review its advisory evidence.",
        )}
      />
    );
  }
  const openPath = safeShipmentOpenPath(signal.open_path);

  return (
    <article
      className="shipment-readiness-detail"
      aria-label={`${signal.code} ${t(
        "intelligence.detail.ariaSuffix",
        "readiness details",
      )}`}
    >
      <header className="shipment-readiness-detail-header">
        <div>
          <p className="eyebrow">
            {t("intelligence.detail.eyebrow", "Shipment readiness")}
          </p>
          <h2><bdi dir="ltr">{signal.code}</bdi></h2>
        </div>
        <StatusPill
          label={readinessBandLabel(signal.band, t)}
          tone={readinessBandTone(signal.band)}
        />
      </header>
      <p className="shipment-readiness-summary" dir="auto">
        {readinessSummary(signal, t, formatNumber)}
      </p>
      <div className="shipment-readiness-detail-grid">
        <DetailItem
          label={t("intelligence.table.lifecycle", "Lifecycle")}
          value={lifecycleLabel(signal.lifecycle_status, t)}
        />
        <DetailItem
          label={t("intelligence.detail.requiredSatisfied", "Required satisfied")}
          value={`${formatNumber(signal.required_satisfied)} ${t(
            "pagination.of",
            "of",
          )} ${formatNumber(signal.required_total)}`}
        />
        <DetailItem
          label={t("intelligence.detail.requiredMissing", "Required missing")}
          value={formatNumber(signal.required_missing)}
        />
        <DetailItem
          label={t("intelligence.detail.requiredReceived", "Required received")}
          value={formatNumber(signal.required_received)}
        />
        <DetailItem
          label={t("intelligence.detail.requiredWaived", "Required waived")}
          value={formatNumber(signal.required_waived)}
        />
        <DetailItem
          label={t(
            "intelligence.detail.requiredNotApplicable",
            "Required not applicable",
          )}
          value={formatNumber(signal.required_not_applicable)}
        />
        <DetailItem
          label={t("intelligence.detail.optional", "Optional requirements")}
          value={formatNumber(signal.optional_total)}
        />
        <DetailItem
          label={t("intelligence.detail.instances", "Document instances")}
          value={formatNumber(signal.document_instance_total)}
        />
        <DetailItem
          label={t("intelligence.detail.verifiedInstances", "Verified instances")}
          value={formatNumber(signal.document_instance_verified)}
        />
        <DetailItem
          label={t("intelligence.detail.rejectedInstances", "Rejected instances")}
          value={formatNumber(signal.document_instance_rejected)}
        />
      </div>
      <section
        className="shipment-readiness-expiry-state"
        aria-label={t(
          "intelligence.detail.expiryEvidence",
          "Document expiry evidence",
        )}
      >
        <h3>
          {t("intelligence.detail.expiry", "Document expiry")}
        </h3>
        <dl>
          <MetadataCount
            label={t(
              "intelligence.detail.expiryEvaluated",
              "Expiry evaluated",
            )}
            value={<bdi dir="auto">
              {formatNumber(signal.document_instance_expiry_evaluated)}
            </bdi>}
          />
          <MetadataCount
            label={t(
              "intelligence.detail.expiryNotRecorded",
              "Expiry not recorded",
            )}
            value={<bdi dir="auto">
              {formatNumber(signal.document_instance_expiry_not_recorded)}
            </bdi>}
          />
          <MetadataCount
            label={t("intelligence.detail.expired", "Expired")}
            value={<bdi dir="auto">
              {formatNumber(signal.document_instance_expired)}
            </bdi>}
          />
          <MetadataCount
            label={t(
              "intelligence.detail.expiringSoon",
              "Expiring soon",
            )}
            value={<bdi dir="auto">
              {formatNumber(signal.document_instance_expiring_soon)}
            </bdi>}
          />
          <MetadataCount
            label={t(
              "intelligence.detail.nextEligibleExpiry",
              "Next eligible expiry",
            )}
            value={signal.next_document_expiry_on ? (
              <bdi dir="auto">
                {formatDate(signal.next_document_expiry_on)}
              </bdi>
            ) : (
              t("form.notSet", "Not set")
            )}
          />
        </dl>
      </section>
      <section
        className="shipment-readiness-reasons"
        aria-label={t("intelligence.detail.reasons", "Readiness reasons")}
      >
        <h3>{t("intelligence.detail.advisoryReasons", "Advisory reasons")}</h3>
        <ul>
          {signal.reason_codes.map((reason) => (
            <li key={reason}>
              <strong>{reasonLabel(reason, t)}</strong>
              <code dir="ltr">{reason}</code>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="shipment-readiness-instance-state"
        aria-label={t(
          "intelligence.detail.metadataStates",
          "Document metadata states",
        )}
      >
        <h3>{t("intelligence.detail.metadata", "Document metadata")}</h3>
        <dl>
          <MetadataCount
            label={t("intelligence.detail.draft", "Draft")}
            value={formatNumber(signal.document_instance_draft)}
          />
          <MetadataCount
            label={t("intelligence.detail.recorded", "Recorded")}
            value={formatNumber(signal.document_instance_recorded)}
          />
          <MetadataCount
            label={t("intelligence.detail.verified", "Verified")}
            value={formatNumber(signal.document_instance_verified)}
          />
          <MetadataCount
            label={t("intelligence.detail.rejected", "Rejected")}
            value={formatNumber(signal.document_instance_rejected)}
          />
          <MetadataCount
            label={t("intelligence.detail.superseded", "Superseded")}
            value={formatNumber(signal.document_instance_superseded)}
          />
        </dl>
      </section>
      {openPath ? (
        <div className="shipment-readiness-detail-actions">
          <a
            className="command-button workspace-action-button"
            data-command="open"
            href={openPath}
          >
            <FolderOpen size={16} aria-hidden="true" />
            <span>{t("intelligence.detail.open", "Open Shipment")}</span>
          </a>
        </div>
      ) : null}
    </article>
  );
}

function MetadataCount({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
