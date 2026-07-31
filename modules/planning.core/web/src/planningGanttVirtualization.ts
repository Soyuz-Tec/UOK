import { useCallback, useEffect, useMemo, useRef, useState, type RefObject, type UIEvent } from "react";

import type { PlanningRowLayout } from "./planningRowHeights";

export const planningVirtualizationThreshold = 200;
const planningVirtualOverscanPx = 480;

export function planningVirtualWindow(
  layouts: PlanningRowLayout[],
  scrollTop: number,
  viewportHeight: number,
  enabled = layouts.length > planningVirtualizationThreshold,
) {
  if (!enabled || layouts.length === 0) return { start: 0, end: layouts.length };
  const from = Math.max(0, scrollTop - planningVirtualOverscanPx);
  const to = scrollTop + viewportHeight + planningVirtualOverscanPx;
  let start = firstLayoutAfter(layouts, from);
  let end = start;
  while (end < layouts.length && layouts[end].top <= to) end += 1;
  start = Math.max(0, start);
  return { start, end: Math.max(start + 1, end) };
}

export function usePlanningGanttVirtualization(
  layouts: PlanningRowLayout[],
  selectedTaskId: string,
  gridRef: RefObject<HTMLDivElement | null>,
  chartRef: RefObject<HTMLDivElement | null>,
) {
  const virtualized = layouts.length > planningVirtualizationThreshold;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const followedSelectionRef = useRef<string | null>(null);
  const window = useMemo(
    () => planningVirtualWindow(layouts, scrollTop, viewportHeight, virtualized),
    [layouts, scrollTop, viewportHeight, virtualized],
  );
  const synchronize = useCallback((value: number, target: HTMLDivElement | null) => {
    if (target && Math.abs(target.scrollTop - value) > 1) target.scrollTop = value;
    setScrollTop(value);
  }, []);
  const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    synchronize(event.currentTarget.scrollTop, chartRef.current);
  }, [chartRef, synchronize]);
  const onChartScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    synchronize(event.currentTarget.scrollTop, gridRef.current);
  }, [gridRef, synchronize]);

  useEffect(() => {
    const measure = () => {
      const heights = [gridRef.current?.clientHeight, chartRef.current?.clientHeight].filter((value): value is number => Boolean(value));
      if (heights.length) setViewportHeight(Math.max(1, Math.min(...heights)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (gridRef.current) observer.observe(gridRef.current);
    if (chartRef.current) observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [chartRef, gridRef, virtualized]);

  useEffect(() => {
    if (!virtualized || !selectedTaskId) {
      followedSelectionRef.current = selectedTaskId || null;
      return;
    }
    if (followedSelectionRef.current === selectedTaskId) return;
    followedSelectionRef.current = selectedTaskId;
    const selected = layouts.find((layout) => layout.taskId === selectedTaskId);
    const currentScrollTop = chartRef.current?.scrollTop ?? gridRef.current?.scrollTop ?? scrollTop;
    if (!selected || (selected.top >= currentScrollTop && selected.top + selected.height <= currentScrollTop + viewportHeight)) return;
    const next = Math.max(0, selected.top - viewportHeight / 3);
    synchronize(next, gridRef.current);
    if (chartRef.current) chartRef.current.scrollTop = next;
  }, [chartRef, gridRef, layouts, scrollTop, selectedTaskId, synchronize, viewportHeight, virtualized]);

  return { ...window, virtualized, onGridScroll, onChartScroll };
}

function firstLayoutAfter(layouts: PlanningRowLayout[], offset: number) {
  let low = 0;
  let high = layouts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const layout = layouts[middle];
    if (layout.top + layout.height < offset) low = middle + 1;
    else high = middle;
  }
  return Math.min(low, layouts.length - 1);
}
