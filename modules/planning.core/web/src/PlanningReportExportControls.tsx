import { Download, FileText } from "lucide-react";
import { useState } from "react";

import { generateAndDownloadReport } from "@uok-modules/reports.core/web/src/serverReports";
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
      <button type="button" className="planning-toolbar-toggle" disabled={unavailable} onClick={() => void runReport("csv", planningScheduleReportRequest(schedule, ["csv"]))}>
        <Download size={16} aria-hidden="true" />
        <span>Export CSV</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" disabled={unavailable} onClick={() => void runReport("csv", planningImportTemplateReportRequest(schedule, ["csv"]))}>
        <Download size={16} aria-hidden="true" />
        <span>Template</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" disabled={unavailable} onClick={() => void runReport("json", planningProjectReportRequest(schedule, ["json"]))}>
        <Download size={16} aria-hidden="true" />
        <span>Project JSON</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" onClick={() => exportPlanningTimelineSvg(schedule)}>
        <Download size={16} aria-hidden="true" />
        <span>Timeline SVG</span>
      </button>
      <button type="button" className="planning-toolbar-toggle" disabled={unavailable} onClick={() => void runReport("md", planningScheduleReportRequest(schedule, ["md"], `${schedule.project.name} schedule document`))}>
        <FileText size={16} aria-hidden="true" />
        <span>Document</span>
      </button>
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
