import type { ModuleAction } from "../shared/types";
import type { CommandResponse, WorkbenchData } from "./useWorkbenchData";

export function useWorkbenchActions(data: WorkbenchData) {
  async function command(command_type: string, payload: Record<string, unknown>, prefix: string) {
    try {
      data.setBusyAction(command_type);
      const response = await data.api<CommandResponse>("/api/commands", {
        method: "POST",
        body: JSON.stringify({ command_type, payload, idempotency_key: `${prefix}:${Date.now()}` })
      });
      data.setOut(response);
      await data.refresh();
      return response;
    } catch (error) {
      data.setOut(error);
      return null;
    } finally {
      data.setBusyAction("");
    }
  }

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

  async function importCsv(filename: string, csvText: string) {
    try {
      data.setBusyAction("ImportContactsCsv");
      const response = await data.api<unknown>("/api/contacts/import-csv", {
        method: "POST",
        body: JSON.stringify({ filename, csv_text: csvText })
      });
      data.setOut(response);
      await data.refresh();
    } catch (error) {
      data.setOut(error);
    } finally {
      data.setBusyAction("");
    }
  }

  return { command, importCsv, moduleAction };
}
