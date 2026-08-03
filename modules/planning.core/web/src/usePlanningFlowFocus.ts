import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

type PendingReconciledFocus = { taskId: string; revision: number };

export function usePlanningFlowFocus(
  revision: number,
  boardRef: RefObject<HTMLDivElement | null>,
  openControlRefs: RefObject<Map<string, HTMLButtonElement>>,
) {
  const activeDragTaskId = useRef<string | null>(null);
  const deferredFocusTaskId = useRef<string | null>(null);
  const deferredFocusOrigin = useRef<Element | null>(null);
  const deferredFocusTimer = useRef<number | null>(null);
  const pendingReconciledFocus = useRef<PendingReconciledFocus | null>(null);

  const cancelDeferredFocus = useCallback(() => {
    if (deferredFocusTimer.current !== null) window.clearTimeout(deferredFocusTimer.current);
    deferredFocusTimer.current = null;
    deferredFocusTaskId.current = null;
    deferredFocusOrigin.current = null;
  }, []);

  const restoreTaskFocus = useCallback((taskId: string) => {
    window.requestAnimationFrame(() => {
      const control = openControlRefs.current.get(taskId);
      if (control?.isConnected) control.focus();
      else boardRef.current?.focus();
    });
  }, [boardRef, openControlRefs]);

  const deferTaskFocus = useCallback((taskId: string) => {
    cancelDeferredFocus();
    deferredFocusTaskId.current = taskId;
    deferredFocusOrigin.current = document.activeElement;
    deferredFocusTimer.current = window.setTimeout(() => {
      if (activeDragTaskId.current !== taskId || deferredFocusTaskId.current !== taskId) return;
      const focusMoved = document.activeElement !== deferredFocusOrigin.current
        && document.activeElement instanceof HTMLElement
        && document.activeElement !== document.body
        && document.activeElement.isConnected;
      activeDragTaskId.current = null;
      cancelDeferredFocus();
      if (!focusMoved) restoreTaskFocus(taskId);
    }, 100);
  }, [cancelDeferredFocus, restoreTaskFocus]);

  useEffect(() => () => cancelDeferredFocus(), [cancelDeferredFocus]);
  useEffect(() => {
    const pending = pendingReconciledFocus.current;
    if (!pending || pending.revision === revision) return;
    pendingReconciledFocus.current = null;
    const focusOrigin = document.activeElement;
    const timer = window.setTimeout(() => {
      const focusMoved = document.activeElement !== focusOrigin
        && document.activeElement instanceof HTMLElement
        && document.activeElement !== document.body
        && document.activeElement.isConnected;
      if (focusMoved) return;
      const control = openControlRefs.current.get(pending.taskId);
      if (control?.isConnected) control.focus();
      else boardRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [boardRef, openControlRefs, revision]);

  return {
    activeDragTaskId,
    cancelDeferredFocus,
    clearReconciledFocus: () => { pendingReconciledFocus.current = null; },
    deferTaskFocus,
    deferredFocusTaskId,
    expectReconciledFocus: (taskId: string, currentRevision: number) => {
      pendingReconciledFocus.current = { taskId, revision: currentRevision };
    },
    restoreTaskFocus,
  };
}
