import type { ModuleAction } from "../shared/types";
import type { WorkbenchData } from "./useWorkbenchData";

export function useWorkbenchActions(data: WorkbenchData) {
  async function moduleAction(moduleName: string, action: ModuleAction) {
    try {
      data.setBusyAction(`${moduleName}:${action}`);
      const response = await data.api<unknown>(`/api/modules/${moduleName}/${action}`, { method: "POST" });
      data.setOut(response);
      await data.refresh();
    } catch (error) {
      data.setOut(error);
    } finally {
      data.setBusyAction("");
    }
  }

  return { moduleAction };
}

export type WorkbenchActions = ReturnType<typeof useWorkbenchActions>;
