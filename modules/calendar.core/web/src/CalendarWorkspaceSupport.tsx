import { Download } from "lucide-react";

import { StatusPill } from "@uok/shared/data-display";
import { Pane } from "@uok/shared/layout";
import { CommandButton } from "@uok/shared/primitives";
import type { ModuleStatus } from "@uok/shared/types";

export function CalendarModuleState({ module, busyAction, onInstall }: { module?: ModuleStatus; busyAction: string; onInstall: () => void }) {
  return (
    <section aria-label="Calendar">
      <Pane title="Calendar" description="Module state" wide>
        <div className="module-row">
          <div className="module-main">
            <div className="module-title-line">
              <h2 className="module-name">calendar.core</h2>
              <StatusPill label={module?.status || "available"} tone="info" />
            </div>
            <p className="module-meta">capability_module - {module?.version || "not loaded"}</p>
          </div>
          <div className="module-actions">
            <CommandButton icon={Download} onClick={onInstall} loading={busyAction === "calendar.core:install"}>Install</CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}

export function calendarErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if ("detail" in error) {
      const detail = (error as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (detail && typeof detail === "object" && "error" in detail) return String((detail as { error: unknown }).error);
      return JSON.stringify(detail);
    }
    if ("error" in error) {
      const detail = (error as { error: unknown }).error;
      if (typeof detail === "string") return detail;
      if (detail && typeof detail === "object" && "message" in detail) {
        const value = detail as { message?: unknown; repair?: unknown };
        return [value.message, value.repair].filter(Boolean).join(" ");
      }
    }
    if ("message" in error) return String((error as { message: unknown }).message);
  }
  return "Calendar operation failed.";
}
