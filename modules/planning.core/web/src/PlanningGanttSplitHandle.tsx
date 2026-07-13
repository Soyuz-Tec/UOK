import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import {
  DEFAULT_PLANNING_SPLIT_PERCENT,
  fitPlanningSplitPercentToContainer,
  planningSplitBoundsForContainer,
  planningSplitKeyCommand,
  planningSplitPercentFromPointer,
} from "./planningGanttSplitModel";

export function PlanningGanttSplitHandle({ containerRef, value, onChange }: {
  containerRef: RefObject<HTMLDivElement | null>;
  value: number;
  onChange: (value: number) => void;
}) {
  const { formatNumber, t } = useUokLocalization();
  const dragging = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const bounds = planningSplitBoundsForContainer(containerWidth);
  const fittedValue = fitPlanningSplitPercentToContainer(value, containerWidth);
  const rounded = Math.round(fittedValue);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateWidth = () => setContainerWidth(container.getBoundingClientRect().width);
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <div
      className="planning-gantt-split-handle"
      role="separator"
      tabIndex={0}
      aria-label={t("planning.split.label", "Resize task grid and timeline")}
      aria-orientation="vertical"
      aria-valuemin={Math.round(bounds.min)}
      aria-valuemax={Math.round(bounds.max)}
      aria-valuenow={rounded}
      aria-valuetext={t("planning.split.value", "{grid}% task grid, {timeline}% timeline")
        .replace("{grid}", formatNumber(rounded))
        .replace("{timeline}", formatNumber(100 - rounded))}
      title={t("planning.split.hint", "Drag to resize. Use arrow keys, Home, or End. Double-click to reset.")}
      onDoubleClick={() => onChange(fitPlanningSplitPercentToContainer(DEFAULT_PLANNING_SPLIT_PERCENT, currentContainerWidth()))}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragging.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) updateFromPointer(event);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        updateFromPointer(event);
        dragging.current = false;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => { dragging.current = false; }}
      onLostPointerCapture={() => { dragging.current = false; }}
    >
      <span aria-hidden="true" />
    </div>
  );

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rtl = getComputedStyle(container).direction === "rtl";
    onChange(planningSplitPercentFromPointer(event.clientX, rect.left, rect.width, rtl));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = containerRef.current ? getComputedStyle(containerRef.current).direction === "rtl" : false;
    const command = planningSplitKeyCommand(value, event.key, event.shiftKey, rtl, currentContainerWidth());
    if (!command.handled) return;
    event.preventDefault();
    onChange(command.value);
  }

  function currentContainerWidth() {
    return containerRef.current?.getBoundingClientRect().width || containerWidth;
  }
}
