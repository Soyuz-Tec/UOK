import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useUokLocalization } from "@uok/shared/localization";
import { IconButton } from "@uok/shared/primitives";
import { clampYear, parseLocalizedYear, YEAR_GRID_COLUMNS, YEAR_PAGE_SIZE, yearPageStart } from "./calendarYears";

export function CalendarYearPicker({
  id,
  year,
  minYear,
  maxYear,
  onSelect,
  onCancel,
}: {
  id: string;
  year: number;
  minYear: number;
  maxYear: number;
  onSelect: (year: number) => void;
  onCancel: () => void;
}) {
  const { direction, locale, t } = useUokLocalization();
  const formatLocale = locale === "ar" ? "ar-u-nu-arab" : locale;
  const formatter = useMemo(
    () => new Intl.NumberFormat(formatLocale, { useGrouping: false }),
    [formatLocale],
  );
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const minPage = yearPageStart(minYear);
  const maxPage = yearPageStart(maxYear);
  const [pageStart, setPageStart] = useState(() => yearPageStart(year));
  const [activeYear, setActiveYear] = useState(year);
  const [inputValue, setInputValue] = useState(() => formatter.format(year));
  const [error, setError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const visibleYears = Array.from(
    { length: YEAR_PAGE_SIZE },
    (_, index) => pageStart + index,
  ).filter((optionYear) => optionYear >= minYear && optionYear <= maxYear);
  const visibleStart = visibleYears[0];
  const visibleEnd = visibleYears.at(-1);
  const rangeLabel = visibleStart === undefined || visibleEnd === undefined
    ? ""
    : `${formatter.format(visibleStart)}–${formatter.format(visibleEnd)}`;

  useEffect(() => {
    queueMicrotask(() => gridRef.current?.querySelector<HTMLElement>(`[data-calendar-year="${year}"]`)?.focus());
  }, [year]);

  const focusYear = (nextYear: number) => {
    const boundedYear = clampYear(nextYear, minYear, maxYear);
    setActiveYear(boundedYear);
    setPageStart(clampYear(yearPageStart(boundedYear), minPage, maxPage));
    queueMicrotask(() => gridRef.current?.querySelector<HTMLElement>(`[data-calendar-year="${boundedYear}"]`)?.focus());
  };

  const changePage = (offset: -1 | 1) => {
    const nextPage = clampYear(pageStart + (offset * YEAR_PAGE_SIZE), minPage, maxPage);
    const relativeIndex = clampYear(activeYear - pageStart, 0, YEAR_PAGE_SIZE - 1);
    setPageStart(nextPage);
    setActiveYear(clampYear(nextPage + relativeIndex, minYear, maxYear));
    setError("");
  };

  const onYearKeyDown = (event: KeyboardEvent<HTMLButtonElement>, optionYear: number) => {
    const horizontalStep = direction === "rtl" ? -1 : 1;
    const nextYear = event.key === "ArrowLeft"
      ? optionYear - horizontalStep
      : event.key === "ArrowRight"
        ? optionYear + horizontalStep
        : event.key === "ArrowUp"
          ? optionYear - YEAR_GRID_COLUMNS
          : event.key === "ArrowDown"
            ? optionYear + YEAR_GRID_COLUMNS
            : event.key === "Home"
              ? Math.max(pageStart, minYear)
              : event.key === "End"
                ? Math.min(pageStart + YEAR_PAGE_SIZE - 1, maxYear)
                : event.key === "PageUp"
                  ? optionYear - YEAR_PAGE_SIZE
                  : event.key === "PageDown"
                    ? optionYear + YEAR_PAGE_SIZE
                    : null;
    if (nextYear === null) return;
    event.preventDefault();
    focusYear(nextYear);
  };

  const submitYear = () => {
    const requestedYear = parseLocalizedYear(inputValue);
    if (requestedYear === null || requestedYear < minYear || requestedYear > maxYear) {
      setError(`${t("calendar.navigator.yearRangeError", "Enter a year from")} ${formatter.format(minYear)}–${formatter.format(maxYear)}.`);
      return;
    }
    setError("");
    onSelect(requestedYear);
  };

  return (
    <section
      id={id}
      className="calendar-year-picker"
      aria-label={t("calendar.navigator.chooseYear", "Choose year")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <div className="calendar-year-range-nav">
        <IconButton
          icon={ChevronLeft}
          label={t("calendar.navigator.previousYears", "Previous 20 years")}
          disabled={pageStart <= minPage}
          onClick={() => changePage(-1)}
        />
        <h4><bdi>{rangeLabel}</bdi></h4>
        <IconButton
          icon={ChevronRight}
          label={t("calendar.navigator.nextYears", "Next 20 years")}
          disabled={pageStart >= maxPage}
          onClick={() => changePage(1)}
        />
      </div>
      <div
        ref={gridRef}
        className="calendar-year-grid"
        role="grid"
        aria-label={`${t("calendar.navigator.chooseYear", "Choose year")}: ${rangeLabel}`}
      >
        {Array.from({ length: Math.ceil(visibleYears.length / YEAR_GRID_COLUMNS) }, (_, rowIndex) => (
          <div key={rowIndex} role="row">
            {visibleYears.slice(rowIndex * YEAR_GRID_COLUMNS, (rowIndex + 1) * YEAR_GRID_COLUMNS).map((optionYear) => (
              <button
                key={optionYear}
                type="button"
                role="gridcell"
                aria-current={optionYear === new Date().getFullYear() ? "date" : undefined}
                aria-selected={optionYear === year}
                className={[
                  optionYear === year ? "selected" : "",
                  optionYear === new Date().getFullYear() ? "current" : "",
                ].filter(Boolean).join(" ")}
                data-calendar-year={optionYear}
                tabIndex={optionYear === activeYear ? 0 : -1}
                onFocus={() => setActiveYear(optionYear)}
                onKeyDown={(event) => onYearKeyDown(event, optionYear)}
                onClick={() => onSelect(optionYear)}
              >
                {formatter.format(optionYear)}
              </button>
            ))}
          </div>
        ))}
      </div>
      <form
        className="calendar-year-jump"
        onSubmit={(event) => {
          event.preventDefault();
          submitYear();
        }}
      >
        <label htmlFor={inputId}>{t("calendar.navigator.goToYear", "Go to year")}</label>
        <div>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={inputValue}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setInputValue(event.target.value);
              setError("");
            }}
          />
          <button type="submit" className="calendar-year-go">{t("calendar.navigator.go", "Go")}</button>
        </div>
        {error ? <p id={errorId} role="alert">{error}</p> : null}
      </form>
      <button type="button" className="calendar-year-back" onClick={onCancel}>
        {t("calendar.navigator.backToDates", "Back to dates")}
      </button>
    </section>
  );
}
