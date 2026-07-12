import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject
} from "react";

const VIEWPORT_MARGIN = 12;
const KEYBOARD_STEP = 16;
const KEYBOARD_FAST_STEP = 48;

type PopupOffset = {
  x: number;
  y: number;
};

type PointerDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  offset: PopupOffset;
};

type PopupBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

function viewportBounds() {
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
  const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;

  return { left, top, right: left + width, bottom: top + height };
}

function boundedValue(value: number, minimum: number, maximum: number) {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(Math.max(value, minimum), maximum);
}

function popupBounds(element: HTMLElement, current: PopupOffset): PopupBounds {
  const rect = element.getBoundingClientRect();
  const backdropStyle = element.parentElement ? window.getComputedStyle(element.parentElement) : null;
  const safeMargin = (value: string | undefined) => Math.max(VIEWPORT_MARGIN, Number.parseFloat(value || "") || 0);
  return {
    left: rect.left - current.x,
    top: rect.top - current.y,
    width: rect.width,
    height: rect.height,
    marginTop: safeMargin(backdropStyle?.paddingTop),
    marginRight: safeMargin(backdropStyle?.paddingRight),
    marginBottom: safeMargin(backdropStyle?.paddingBottom),
    marginLeft: safeMargin(backdropStyle?.paddingLeft)
  };
}

function clampOffset(bounds: PopupBounds, desired: PopupOffset): PopupOffset {
  const viewport = viewportBounds();
  const minimumX = viewport.left + bounds.marginLeft - bounds.left;
  const maximumX = viewport.right - bounds.marginRight - bounds.width - bounds.left;
  const minimumY = viewport.top + bounds.marginTop - bounds.top;
  const maximumY = viewport.bottom - bounds.marginBottom - bounds.height - bounds.top;

  return {
    x: boundedValue(desired.x, minimumX, maximumX),
    y: boundedValue(desired.y, minimumY, maximumY)
  };
}

export function useWorkspacePopupDrag(popupRef: RefObject<HTMLElement | null>, open: boolean) {
  const [offset, setOffset] = useState<PopupOffset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(offset);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const popupBoundsRef = useRef<PopupBounds | null>(null);

  const updateOffset = useCallback((desired: PopupOffset) => {
    const element = popupRef.current;
    if (element && !popupBoundsRef.current) {
      popupBoundsRef.current = popupBounds(element, offsetRef.current);
    }
    const nextOffset = popupBoundsRef.current ? clampOffset(popupBoundsRef.current, desired) : desired;
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, [popupRef]);

  const resetPosition = useCallback(() => {
    pointerDragRef.current = null;
    setDragging(false);
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      resetPosition();
      popupBoundsRef.current = null;
    }
  }, [open, resetPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const keepInsideViewport = () => {
      if (popupRef.current) popupBoundsRef.current = popupBounds(popupRef.current, offsetRef.current);
      updateOffset(offsetRef.current);
    };
    const viewport = window.visualViewport;
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(keepInsideViewport);

    window.addEventListener("resize", keepInsideViewport);
    viewport?.addEventListener("resize", keepInsideViewport);
    viewport?.addEventListener("scroll", keepInsideViewport);
    if (popupRef.current) resizeObserver?.observe(popupRef.current);

    return () => {
      window.removeEventListener("resize", keepInsideViewport);
      viewport?.removeEventListener("resize", keepInsideViewport);
      viewport?.removeEventListener("scroll", keepInsideViewport);
      resizeObserver?.disconnect();
      pointerDragRef.current = null;
      popupBoundsRef.current = null;
      setDragging(false);
    };
  }, [open, popupRef, updateOffset]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.currentTarget.focus();
    pointerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset: offsetRef.current
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateOffset({
      x: drag.offset.x + event.clientX - drag.startX,
      y: drag.offset.y + event.clientY - drag.startY
    });
  }, [updateOffset]);

  const finishPointerDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    pointerDragRef.current = null;
    setDragging(false);
  }, []);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      resetPosition();
      return;
    }

    const step = event.shiftKey ? KEYBOARD_FAST_STEP : KEYBOARD_STEP;
    const movement: Record<string, PopupOffset> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step }
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    updateOffset({
      x: offsetRef.current.x + delta.x,
      y: offsetRef.current.y + delta.y
    });
  }, [resetPosition, updateOffset]);

  const popupStyle = {
    "--workspace-popup-x": `${offset.x}px`,
    "--workspace-popup-y": `${offset.y}px`
  } as CSSProperties;

  return {
    popupStyle,
    dragging,
    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointerDrag,
      onPointerCancel: finishPointerDrag,
      onLostPointerCapture: finishPointerDrag,
      onKeyDown,
      onDoubleClick: resetPosition
    }
  };
}
