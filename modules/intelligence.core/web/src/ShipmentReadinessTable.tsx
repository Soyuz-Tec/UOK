import { useMemo, type KeyboardEvent, type ReactNode } from "react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { ResizableDataTable, type DataTableColumn } from "@uok/shared/tables";
import {
  lifecycleLabel,
  readinessBandLabel,
  readinessBandTone,
} from "./readinessDisplay";
import type { ShipmentReadinessSignal } from "./types";

export function ShipmentReadinessTable({
  signals,
  selectedId,
  emptyState,
  onSelect,
}: {
  signals: ShipmentReadinessSignal[];
  selectedId: string;
  emptyState: ReactNode;
  onSelect: (id: string) => void;
}) {
  const { formatNumber, t } = useUokLocalization();
  const columns = useMemo<DataTableColumn<ShipmentReadinessSignal>[]>(() => [
    {
      id: "shipment",
      header: t("intelligence.table.shipment", "Shipment"),
      defaultWidth: 220,
      minWidth: 155,
      renderCell: (signal) => <strong><bdi dir="ltr">{signal.code}</bdi></strong>,
    },
    {
      id: "lifecycle",
      header: t("intelligence.table.lifecycle", "Lifecycle"),
      defaultWidth: 145,
      minWidth: 115,
      renderCell: (signal) => lifecycleLabel(signal.lifecycle_status, t),
    },
    {
      id: "readiness",
      header: t("intelligence.table.readiness", "Readiness"),
      defaultWidth: 185,
      minWidth: 150,
      renderCell: (signal) => (
        <StatusPill
          label={readinessBandLabel(signal.band, t)}
          tone={readinessBandTone(signal.band)}
        />
      ),
    },
    {
      id: "missing",
      header: t("intelligence.table.missingRequired", "Missing required"),
      defaultWidth: 155,
      minWidth: 130,
      renderCell: (signal) => formatNumber(signal.required_missing),
    },
  ], [formatNumber, t]);
  const tabStopId = signals.some((signal) => signal.shipment_id === selectedId)
    ? selectedId
    : signals[0]?.shipment_id;

  return (
    <ResizableDataTable
      ariaLabel={t("intelligence.table", "Shipment readiness signals")}
      columns={columns}
      rows={signals}
      getRowKey={(signal) => signal.shipment_id}
      storageKey="uok_intelligence_shipment_readiness_table_widths"
      emptyState={emptyState || (
        <EmptyState
          title={t("intelligence.empty.title", "No readiness signals")}
          text={t(
            "intelligence.empty.text",
            "No tenant-visible Shipments are available.",
          )}
        />
      )}
      rowAriaLabel={(signal) => (
        `${signal.code} ${readinessBandLabel(signal.band, t)}`
      )}
      rowAriaSelected={(signal) => signal.shipment_id === selectedId}
      rowClassName={(signal) => signal.shipment_id === selectedId ? "selected" : ""}
      rowTabIndex={(signal) => signal.shipment_id === tabStopId ? 0 : -1}
      onRowClick={(signal) => onSelect(signal.shipment_id)}
      onRowKeyDown={(event, signal) => selectFromKeyboard(
        event,
        signal.shipment_id,
        signals,
        onSelect,
      )}
    />
  );
}

function selectFromKeyboard(
  event: KeyboardEvent<HTMLTableRowElement>,
  id: string,
  signals: ShipmentReadinessSignal[],
  onSelect: (id: string) => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect(id);
    return;
  }
  const currentIndex = signals.findIndex((signal) => signal.shipment_id === id);
  const nextIndex = keyboardTargetIndex(event.key, currentIndex, signals.length);
  if (nextIndex === null) return;
  event.preventDefault();
  onSelect(signals[nextIndex].shipment_id);
  const rows = event.currentTarget.parentElement
    ?.querySelectorAll<HTMLTableRowElement>("tr[tabindex]");
  rows?.item(nextIndex).focus();
}

function keyboardTargetIndex(key: string, current: number, count: number) {
  if (current < 0 || count === 0) return null;
  if (key === "ArrowDown") return Math.min(current + 1, count - 1);
  if (key === "ArrowUp") return Math.max(current - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
