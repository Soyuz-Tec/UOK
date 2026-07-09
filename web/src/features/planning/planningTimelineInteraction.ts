import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import type { TimelineScale } from "./planningGanttModel";
import { svgPointer } from "./planningDependencyDrag";
import { adjacentTimelineScale } from "./planningScaleOptions";
import { timelineCreateDraft, type TimelineCreateDraft } from "./planningTimelineCreateModel";

type PanState = { pointerId: number; startX: number; scrollLeft: number } | null;
type CreateState = { pointerId: number; startX: number } | null;

export function usePlanningTimelineInteraction(
  scrollRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  options: {
    chartStart: Date;
    cellWidth: number;
    scale: TimelineScale;
    onCreateTaskRange: (start: string, end: string) => void;
    onScaleChange: (scale: TimelineScale) => void;
  },
) {
  const { cellWidth, chartStart, onCreateTaskRange, onScaleChange, scale } = options;
  const panRef = useRef<PanState>(null);
  const createRef = useRef<CreateState>(null);
  const draftRef = useRef<TimelineCreateDraft | null>(null);
  const zoomRef = useRef<{ ratio: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [createDraft, setCreateDraft] = useState<TimelineCreateDraft | null>(null);

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
    createDraft,
    panning,
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || !canPanFrom(event.target)) return;
      const node = scrollRef.current;
      if (!node) return;
      if (event.shiftKey && svgRef.current) {
        const point = svgPointer(svgRef.current, event.clientX, event.clientY);
        const draft = timelineCreateDraft(point.x, point.x, chartStart, scale, cellWidth);
        createRef.current = { pointerId: event.pointerId, startX: point.x };
        draftRef.current = draft;
        setCreateDraft(draft);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      panRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: node.scrollLeft };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const create = createRef.current;
      if (create?.pointerId === event.pointerId && svgRef.current) {
        const point = svgPointer(svgRef.current, event.clientX, event.clientY);
        const draft = timelineCreateDraft(create.startX, point.x, chartStart, scale, cellWidth);
        draftRef.current = draft;
        setCreateDraft(draft);
        return;
      }
      const pan = panRef.current;
      const node = scrollRef.current;
      if (!pan || !node || event.pointerId !== pan.pointerId) return;
      node.scrollLeft = Math.max(0, pan.scrollLeft - (event.clientX - pan.startX));
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      if (createRef.current?.pointerId === event.pointerId) {
        const draft = draftRef.current;
        createRef.current = null;
        draftRef.current = null;
        setCreateDraft(null);
        if (draft && draft.width >= 8) onCreateTaskRange(draft.start, draft.end);
        return;
      }
      if (panRef.current?.pointerId !== event.pointerId) return;
      panRef.current = null;
      setPanning(false);
    },
    onPointerCancel() {
      panRef.current = null;
      createRef.current = null;
      draftRef.current = null;
      setCreateDraft(null);
      setPanning(false);
    },
  };
}

function canPanFrom(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".planning-owned-background, .planning-owned-header")) && !target.closest(".planning-owned-task, .planning-owned-link-handle, .planning-owned-resize-handle, .planning-owned-progress-handle");
}
