import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import type { TimelineScale } from "./planningGanttModel";
import { adjacentTimelineScale } from "./planningScaleOptions";

type PanState = { pointerId: number; startX: number; scrollLeft: number } | null;

export function usePlanningTimelineInteraction(
  scrollRef: RefObject<HTMLDivElement | null>,
  scale: TimelineScale,
  onScaleChange: (scale: TimelineScale) => void,
) {
  const panRef = useRef<PanState>(null);
  const zoomRef = useRef<{ ratio: number } | null>(null);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    const zoom = zoomRef.current;
    if (!node || !zoom) return;
    zoomRef.current = null;
    requestAnimationFrame(() => {
      node.scrollLeft = Math.max(0, (node.scrollWidth - node.clientWidth) * zoom.ratio);
    });
  }, [scale, scrollRef]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const nextScale = adjacentTimelineScale(scale, event.deltaY < 0 ? "in" : "out");
      if (nextScale === scale) return;
      zoomRef.current = { ratio: node.scrollLeft / Math.max(1, node.scrollWidth - node.clientWidth) };
      onScaleChange(nextScale);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onScaleChange, scale, scrollRef]);

  return {
    panning,
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || !canPanFrom(event.target)) return;
      const node = scrollRef.current;
      if (!node) return;
      panRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: node.scrollLeft };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const pan = panRef.current;
      const node = scrollRef.current;
      if (!pan || !node || event.pointerId !== pan.pointerId) return;
      node.scrollLeft = Math.max(0, pan.scrollLeft - (event.clientX - pan.startX));
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (panRef.current?.pointerId !== event.pointerId) return;
      panRef.current = null;
      setPanning(false);
    },
    onPointerCancel() {
      panRef.current = null;
      setPanning(false);
    },
  };
}

function canPanFrom(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".planning-owned-background, .planning-owned-header")) && !target.closest(".planning-owned-task, .planning-owned-link-handle, .planning-owned-resize-handle, .planning-owned-progress-handle");
}
