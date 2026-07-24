import { useUokLocalization } from "@uok/shared/localization";

export function CalendarEventStatus({ status }: { status: string }) {
  const { t } = useUokLocalization();
  const label = status === "canceled"
    ? t("calendar.event.status.canceled", "Canceled")
    : status === "tentative"
      ? t("calendar.event.status.tentative", "Tentative")
      : "";
  if (!label) return null;
  return (
    <span className={`calendar-event-status ${status}`}>
      <span className="visually-hidden">{", "}{t("calendar.event.status.label", "Status")}: </span>
      {" "}{label}
    </span>
  );
}
