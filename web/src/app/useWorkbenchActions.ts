import { useRef } from "react";

import type { ModuleAction } from "../shared/types";
import type { WorkbenchData } from "./useWorkbenchData";

export function useWorkbenchActions(data: WorkbenchData) {
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());

  function moduleAction(moduleName: string, action: ModuleAction) {
    const queuedAction = actionQueueRef.current.then(() => runModuleAction(moduleName, action));
    actionQueueRef.current = queuedAction.catch(() => undefined);
    return queuedAction;
  }

  async function runModuleAction(moduleName: string, action: ModuleAction) {
    const request = data.beginRequest("module-action");
    const busyKey = `${moduleName}:${action}`;
    try {
      if (!request.isCurrent()) return;
      request.runIfCurrent(() => data.setBusyAction(busyKey, request.generation));
      const response = await data.api<unknown>(
        `/api/modules/${moduleName}/${action}`,
        { method: "POST" },
        request
      );
      if (!request.isCurrent()) return;
      data.setOut(response, request.generation);
      await data.refresh(request);
    } catch (error) {
      request.runIfCurrent(() => data.setOut(error, request.generation));
    } finally {
      request.runIfCurrent(() => data.clearBusyAction(busyKey, request.generation));
      request.release();
    }
  }

  return { moduleAction };
}

export type WorkbenchActions = ReturnType<typeof useWorkbenchActions>;
