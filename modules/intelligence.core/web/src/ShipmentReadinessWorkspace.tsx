import { useEffect, useMemo, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { useUokLocalization } from "@uok/shared/localization";
import { IntelligenceModuleState } from "./IntelligenceModuleState";
import { ShipmentReadinessDetail } from "./ShipmentReadinessDetail";
import {
  ShipmentReadinessEvaluationControl,
  ShipmentReadinessEvaluationSummary,
} from "./ShipmentReadinessEvaluation";
import { ShipmentReadinessTable } from "./ShipmentReadinessTable";
import { INTELLIGENCE_MODULE_ID } from "./intelligenceModule";
import { filterShipmentReadiness } from "./readinessFilters";
import type { ShipmentReadinessBandFilter } from "./types";
import { useEphemeralSavedViewsKey } from "./useEphemeralSavedViewsKey";
import { useShipmentReadiness } from "./useShipmentReadiness";

export function ShipmentReadinessWorkspace({
  host,
}: {
  host: ModuleSurfaceHostContext;
}) {
  const { formatNumber, t } = useUokLocalization();
  const module = host.moduleRows.find((row) => row.name === INTELLIGENCE_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const [asOfDate, setAsOfDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const validAsOfDate = /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)
    ? asOfDate
    : null;
  const readiness = useShipmentReadiness(host, operational, validAsOfDate);
  const [query, setQuery] = useState("");
  const [bandFilter, setBandFilter] = useState<ShipmentReadinessBandFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const savedViewsStorageKey = useEphemeralSavedViewsKey(host.session.token);
  const bandOptions = useMemo(() => [
    { value: "all", label: t("intelligence.band.all", "All readiness signals") },
    {
      value: "attention_required",
      label: t("intelligence.band.attention_required", "Attention required"),
    },
    {
      value: "not_assessed",
      label: t("intelligence.band.not_assessed", "Not assessed"),
    },
    { value: "ready", label: t("intelligence.band.ready", "Ready") },
  ], [t]);
  const visibleSignals = useMemo(
    () => filterShipmentReadiness(readiness.signals, query, bandFilter),
    [bandFilter, query, readiness.signals],
  );
  const selected = visibleSignals.find((row) => row.shipment_id === selectedId) || null;
  const requestError = validAsOfDate
    ? readiness.error
    : t("intelligence.asOf.required", "Choose an As-of date.");
  const status = requestError || (
    readiness.loading
      ? t(
        readiness.signals.length
          ? "intelligence.status.refreshing"
          : "intelligence.status.loading",
        readiness.signals.length
          ? "Refreshing Shipment Readiness."
          : "Loading Shipment Readiness.",
      )
      : t(
        readiness.signals.length === 1
          ? "intelligence.status.loaded.one"
          : "intelligence.status.loaded.many",
        readiness.signals.length === 1
          ? "{count} Shipment readiness signal loaded."
          : "{count} Shipment readiness signals loaded.",
      ).replace("{count}", formatNumber(readiness.signals.length))
  );

  useEffect(() => {
    if (visibleSignals.some((row) => row.shipment_id === selectedId)) return;
    setSelectedId(
      visibleSignals.find((row) => row.band === "attention_required")?.shipment_id
        || visibleSignals[0]?.shipment_id
        || "",
    );
  }, [selectedId, visibleSignals]);

  if (!host.session.token) {
    return (
      <EmptyState
        text={t("intelligence.signIn", "Sign in to open Shipment Readiness.")}
      />
    );
  }
  if (!operational) return <IntelligenceModuleState module={module} host={host} />;

  return (
    <section
      className="shipment-readiness-workspace"
      aria-label={t("intelligence.workspace", "Shipment Readiness")}
    >
      <WorkspaceCommandBar
        label={t("intelligence.controls", "Shipment Readiness controls")}
        query={(
          <SearchWorkspace
            key={savedViewsStorageKey}
            label={t("intelligence.search", "Search Shipment readiness")}
            value={query}
            placeholder={t(
              "intelligence.searchPlaceholder",
              "Search shipments",
            )}
            defaultSummaryLabel={t(
              "intelligence.band.all",
              "All readiness signals",
            )}
            filters={[{
              id: "band",
              label: t("intelligence.filter", "Readiness"),
              value: bandFilter,
              defaultValue: "all",
              options: bandOptions,
              onChange: (value) => setBandFilter(value as ShipmentReadinessBandFilter),
            }]}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey={savedViewsStorageKey}
            savedViewsStorageKind="session"
            onChange={setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              setQuery("");
              setBandFilter("all");
            }}
          />
        )}
        context={(
          <ShipmentReadinessEvaluationControl
            asOfDate={asOfDate}
            onChange={setAsOfDate}
          />
        )}
        secondaryActions={(
          <WorkspaceActionsMenu items={[{
            id: "refresh",
            action: "refresh",
            loading: readiness.loading,
            disabled: readiness.loading || !validAsOfDate,
            onSelect: () => void readiness.refresh(),
          }]} />
        )}
      />
      <div className="shipment-readiness-status-region">
        {readiness.sourceSummary ? (
          <p className="shipment-readiness-source">
            <strong>{t("intelligence.source.label", "Source:")}</strong>{" "}
            {t(
              "intelligence.source.available",
              "Shipment readiness source is available.",
            )}
          </p>
        ) : null}
        <p
          className="shipment-readiness-status"
          role={requestError ? "alert" : "status"}
        >
          {status}
        </p>
        {readiness.evaluation ? (
          <ShipmentReadinessEvaluationSummary
            evaluation={readiness.evaluation}
          />
        ) : null}
      </div>
      <WorkflowSplitView
        primaryLabel={t(
          "intelligence.primary",
          "Shipment readiness signals",
        )}
        secondaryLabel={t(
          "intelligence.secondary",
          "Shipment readiness details",
        )}
        primary={(
          <ShipmentReadinessTable
            signals={visibleSignals}
            selectedId={selectedId}
            emptyState={tableEmptyState(
              readiness.loading,
              requestError,
              !validAsOfDate,
              query,
              bandFilter,
              t,
            )}
            onSelect={setSelectedId}
          />
        )}
        secondary={<ShipmentReadinessDetail signal={selected} />}
      />
    </section>
  );
}

function tableEmptyState(
  loading: boolean,
  error: string,
  invalidAsOf: boolean,
  query: string,
  band: ShipmentReadinessBandFilter,
  t: (key: string, fallback?: string) => string,
) {
  if (invalidAsOf) {
    return (
      <EmptyState
        title={t(
          "intelligence.empty.asOfTitle",
          "As-of date required",
        )}
        text={t(
          "intelligence.asOf.required",
          "Choose an As-of date.",
        )}
      />
    );
  }
  if (loading) {
    return (
      <EmptyState
        title={t(
          "intelligence.empty.loadingTitle",
          "Loading Shipment readiness",
        )}
        text={t(
          "intelligence.empty.loadingText",
          "Reading current owner facts.",
        )}
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        title={t(
          "intelligence.empty.unavailableTitle",
          "Shipment readiness unavailable",
        )}
        text={t("intelligence.empty.retry", "Use Refresh to try again.")}
      />
    );
  }
  if (query.trim() || band !== "all") {
    return (
      <EmptyState
        title={t(
          "intelligence.empty.noMatchTitle",
          "No matching Shipments",
        )}
        text={t(
          "intelligence.empty.noMatchText",
          "Adjust the search or readiness filter.",
        )}
      />
    );
  }
  return (
    <EmptyState
      title={t("intelligence.empty.title", "No readiness signals")}
      text={t(
        "intelligence.empty.text",
        "No tenant-visible Shipments are available.",
      )}
    />
  );
}
