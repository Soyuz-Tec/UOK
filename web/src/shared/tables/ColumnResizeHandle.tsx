import type { KeyboardEvent, PointerEvent } from "react";

const resizeStep = 8;
const acceleratedResizeStep = 24;

export function ColumnResizeHandle({
  label,
  maxWidth = 640,
  minWidth = 80,
  width,
  onResize,
  onReset,
}: {
  label: string;
  maxWidth?: number;
  minWidth?: number;
  width: number;
  onResize: (width: number) => void;
  onReset: () => void;
}) {
  const startPointerResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const resize = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + moveEvent.clientX - startX);
    const stop = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const resizeFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? acceleratedResizeStep : resizeStep;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onResize(width - step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onResize(width + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      onResize(minWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      onResize(maxWidth);
    }
  };

  return (
    <div
      className="column-resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemax={maxWidth}
      aria-valuemin={minWidth}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      onDoubleClick={onReset}
      onKeyDown={resizeFromKeyboard}
      onPointerDown={startPointerResize}
    />
  );
}
