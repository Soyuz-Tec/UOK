import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";

import { useUokLocalization } from "@uok/shared/localization";

export const CalendarYearTrigger = forwardRef<HTMLButtonElement, {
  controls: string;
  open: boolean;
  year: number;
  onClick: () => void;
}>(function CalendarYearTrigger({ controls, open, year, onClick }, ref) {
  const { locale, t } = useUokLocalization();
  const formatLocale = locale === "ar" ? "ar-u-nu-arab" : locale;
  const formattedYear = new Intl.NumberFormat(formatLocale, { useGrouping: false }).format(year);

  return (
    <button
      ref={ref}
      type="button"
      className="calendar-year-trigger"
      aria-controls={controls}
      aria-expanded={open}
      aria-label={`${t("calendar.navigator.chooseYear", "Choose year")}: ${formattedYear}`}
      onClick={onClick}
    >
      <bdi>{formattedYear}</bdi>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
  );
});
