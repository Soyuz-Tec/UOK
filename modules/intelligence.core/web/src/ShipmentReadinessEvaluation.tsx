import { useUokLocalization } from "@uok/shared/localization";
import type { ShipmentReadinessEvaluationMetadata } from "./types";

export function ShipmentReadinessEvaluationControl({
  asOfDate,
  onChange,
}: {
  asOfDate: string;
  onChange: (value: string) => void;
}) {
  const { t } = useUokLocalization();
  return (
    <div className="shipment-readiness-evaluation-control">
      <label className="field">
        <span>{t("intelligence.asOf.label", "As-of date")}</span>
        <input
          aria-describedby="shipment-readiness-timezone"
          dir="ltr"
          required
          type="date"
          value={asOfDate}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </label>
      <span
        className="shipment-readiness-timezone"
        id="shipment-readiness-timezone"
      >
        {t(
          "intelligence.asOf.timezone",
          "Evaluation timezone:",
        )}{" "}
        <bdi dir="ltr">UTC</bdi>
      </span>
    </div>
  );
}

export function ShipmentReadinessEvaluationSummary({
  evaluation,
}: {
  evaluation: ShipmentReadinessEvaluationMetadata;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  return (
    <p className="shipment-readiness-evaluation">
      <strong>
        {t("intelligence.evaluation.label", "Evaluation:")}
      </strong>{" "}
      <span>{t("intelligence.evaluation.asOf", "As of")} </span>
      <bdi dir="auto">{formatDate(evaluation.as_of)}</bdi>
      <span> {t("intelligence.evaluation.in", "in")} </span>
      <bdi dir="ltr">{evaluation.evaluation_timezone}</bdi>
      <span>. {t(
        "intelligence.evaluation.through",
        "Expiring soon through",
      )} </span>
      <bdi dir="auto">{formatDate(evaluation.expiring_soon_through)}</bdi>
      <span> (</span>
      <bdi dir="auto">
        {formatNumber(evaluation.expiring_soon_horizon_days)}
      </bdi>
      <span> {t(
        "intelligence.evaluation.inclusiveDays",
        "days, inclusive",
      )}).</span>
    </p>
  );
}
