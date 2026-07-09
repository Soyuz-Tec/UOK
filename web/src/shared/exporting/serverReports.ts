export type ReportFormat = "txt" | "md" | "json" | "jsonl" | "csv" | "tsv";

export type GenerateReportRequest = {
  source_module: string;
  template_key: string;
  formats: ReportFormat[];
  title: string;
  filename_base?: string;
  payload: Record<string, unknown>;
  options?: Record<string, unknown>;
};

export type ReportArtifact = {
  id: string;
  format: ReportFormat;
  filename: string;
  media_type: string;
  byte_size: number;
  status: string;
};

type GenerateReportResponse = {
  artifacts: ReportArtifact[];
  artifact_count: number;
};

export async function generateReportArtifacts(token: string, request: GenerateReportRequest) {
  const response = await fetch("/api/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data as GenerateReportResponse;
}

export async function downloadReportArtifact(token: string, artifact: ReportArtifact) {
  const response = await fetch(`/api/reports/artifacts/${artifact.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await response.json().catch(() => ({}));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function generateAndDownloadReport(token: string, request: GenerateReportRequest, format: ReportFormat) {
  const result = await generateReportArtifacts(token, { ...request, formats: [format] });
  const artifact = result.artifacts.find((item) => item.format === format) || result.artifacts[0];
  if (!artifact) throw new Error("report generation returned no artifacts");
  await downloadReportArtifact(token, artifact);
  return artifact;
}
