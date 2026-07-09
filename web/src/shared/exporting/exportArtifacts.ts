export type ExportArtifact = {
  content: string;
  filename: string;
  mimeType: string;
};

export function exportFilename(baseName: string, suffix: string, extension: string) {
  return `${safeExportSlug(baseName)}-${safeExportSlug(suffix)}.${safeExportSlug(extension)}`;
}

export function csvContent(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function jsonContent(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function textArtifact(filename: string, content: string, mimeType: string): ExportArtifact {
  return { content, filename, mimeType };
}

export function downloadExportArtifact(artifact: ExportArtifact) {
  const blob = new Blob([artifact.content], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function xmlText(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function safeExportSlug(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
}
