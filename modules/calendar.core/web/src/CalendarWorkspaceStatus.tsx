import { useUokLocalization } from "@uok/shared/localization";

export function CalendarWorkspaceStatus({
  eventCount,
  busyCount,
  message,
  error,
}: {
  eventCount: number;
  busyCount: number;
  message: string;
  error: string;
}) {
  const { formatNumber, t } = useUokLocalization();
  const eventLabel = t(`calendar.status.event.${eventCount === 1 ? "one" : "many"}`, eventCount === 1 ? "event" : "events");
  const busyLabel = t(`calendar.status.busyBlock.${busyCount === 1 ? "one" : "many"}`, busyCount === 1 ? "busy block" : "busy blocks");

  return (
    <>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {formatNumber(eventCount)} {eventLabel}. {formatNumber(busyCount)} {busyLabel}. {message}
      </p>
      {error ? <p className="calendar-workspace-error" role="alert">{error}</p> : null}
    </>
  );
}
