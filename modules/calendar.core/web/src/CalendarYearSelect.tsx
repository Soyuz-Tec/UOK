import { useMemo } from "react";

const YEAR_BROWSE_RADIUS = 100;

export function CalendarYearSelect({
  year,
  locale,
  label,
  onChange,
}: {
  year: number;
  locale: string;
  label: string;
  onChange: (year: number) => void;
}) {
  const yearFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { useGrouping: false }),
    [locale],
  );
  const yearOptions = useMemo(
    () => Array.from(
      { length: (YEAR_BROWSE_RADIUS * 2) + 1 },
      (_, index) => year - YEAR_BROWSE_RADIUS + index,
    ),
    [year],
  );

  return (
    <select aria-label={label} value={year} onChange={(event) => onChange(Number(event.target.value))}>
      {yearOptions.map((optionYear) => (
        <option key={optionYear} value={optionYear}>{yearFormatter.format(optionYear)}</option>
      ))}
    </select>
  );
}
