import { useState } from "react";

import { generateAndDownloadReport } from "@uok-modules/reports.core/web/src/serverReports";
import { WorkspaceActionButton } from "@uok/shared/actions";
import {
  exportPlanningTimelineSvg,
  planningImportTemplateReportRequest,
  planningProjectReportRequest,
  planningScheduleReportRequest,
} from "./planningExportModel";
import type { PlanningSchedule } from "./types";


export function PlanningReportExportControls({
  reportsOperational,
  schedule,
  token,
}: {
  reportsOperational: boolean;
  schedule: PlanningSchedule;
  token: string;
}) {
  const [reportStatus, setReportStatus] = useState("");
  const unavailable = !reportsOperational;
  return (
    <div className="planning-utility-group planning-export-controls" aria-label="Schedule exports">
      <WorkspaceActionButton action="export" labelKey="command.exportCsv" fallbackLabel="Export CSV" disabled={unavailable} onClick={() => void runReport("csv", planningScheduleReportRequest(schedule, ["csv"]))} />
      <WorkspaceActionButton action="export" labelKey="command.importTemplate" fallbackLabel="Template" disabled={unavailable} onClick={() => void runReport("csv", planningImportTemplateReportRequest(schedule, ["csv"]))} />
      <WorkspaceActionButton action="export" labelKey="command.projectJson" fallbackLabel="Project JSON" disabled={unavailable} onClick={() => void runReport("json", planningProjectReportRequest(schedule, ["json"]))} />
      <WorkspaceActionButton action="export" labelKey="command.timelineSvg" fallbackLabel="Timeline SVG" onClick={() => exportPlanningTimelineSvg(schedule)} />
      <WorkspaceActionButton action="export" labelKey="command.document" fallbackLabel="Document" disabled={unavailable} onClick={() => void runReport("md", planningScheduleReportRequest(schedule, ["md"], `${schedule.project.name} schedule document`))} />
      {unavailable ? (
        <span className="planning-muted" role="status">Reports unavailable; report artifacts are disabled while Planning remains operational.</span>
      ) : reportStatus ? (
        <span className="planning-muted" aria-live="polite">{reportStatus}</span>
      ) : null}
    </div>
  );

  async function runReport(
    format: "csv" | "json" | "md",
    request: Parameters<typeof generateAndDownloadReport>[1],
  ) {
    if (!reportsOperational) return;
    setReportStatus("Generating report");
    try {
      const artifact = await generateAndDownloadReport(token, request, format);
      setReportStatus(`Downloaded ${artifact.filename}`);
    } catch {
      setReportStatus("Report export failed");
    }
  }
}
