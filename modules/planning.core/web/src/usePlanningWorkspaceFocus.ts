import { useEffect, useRef } from "react";

interface PlanningWorkspaceFocusOptions {
  projectCreateOpen: boolean;
  projectId?: string;
  workspaceMode: "project" | "portfolio";
}

export function usePlanningWorkspaceFocus({
  projectCreateOpen,
  projectId,
  workspaceMode,
}: PlanningWorkspaceFocusOptions) {
  const planningWorkspaceRef = useRef<HTMLElement>(null);
  const focusAfterCreateRef = useRef(false);

  useEffect(() => {
    if (projectCreateOpen || !focusAfterCreateRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      focusAfterCreateRef.current = false;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement && active.isConnected) return;
      const picker = planningWorkspaceRef.current?.querySelector<HTMLSelectElement>(".planning-project-picker select");
      (picker || planningWorkspaceRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectCreateOpen, projectId, workspaceMode]);

  function focusPlanningInspectorClose() {
    window.requestAnimationFrame(() => {
      planningWorkspaceRef.current
        ?.querySelector<HTMLButtonElement>(".planning-inspector-popup .workspace-popup-close")
        ?.focus();
    });
  }

  return { planningWorkspaceRef, focusAfterCreateRef, focusPlanningInspectorClose };
}
