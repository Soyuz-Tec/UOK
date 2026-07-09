export type ExportArtifact = {
  content: string;
  filename: string;
  mimeType: string;
};

export type HtmlDocumentTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};

export type HtmlDocumentSection = {
  heading: string;
  paragraphs?: string[];
  definitionList?: Array<[string, string]>;
  tables?: HtmlDocumentTable[];
};

export type HtmlDocumentModel = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  sections: HtmlDocumentSection[];
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

export function htmlDocumentContent(document: HtmlDocumentModel) {
  const generated = document.generatedAt ? `<p class="uok-generated">Generated ${xmlText(document.generatedAt)}</p>` : "";
  const sections = document.sections.map((section) => htmlSection(section)).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${xmlText(document.title)}</title>
  <style>
    body { color: #0f172a; font-family: Arial, sans-serif; line-height: 1.45; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    h2 { border-bottom: 1px solid #cbd5e1; font-size: 16px; margin: 28px 0 12px; padding-bottom: 6px; }
    table { border-collapse: collapse; margin: 10px 0 18px; width: 100%; }
    th, td { border: 1px solid #cbd5e1; font-size: 12px; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #334155; font-weight: 700; }
    caption { color: #475569; font-size: 12px; font-weight: 700; margin-bottom: 6px; text-align: left; }
    dl { display: grid; gap: 6px 18px; grid-template-columns: max-content 1fr; margin: 10px 0 18px; }
    dt { color: #475569; font-size: 12px; font-weight: 700; }
    dd { margin: 0; font-size: 12px; }
    .uok-subtitle, .uok-generated, p { color: #475569; font-size: 13px; margin: 4px 0; }
  </style>
</head>
<body>
  <header>
    <h1>${xmlText(document.title)}</h1>
    ${document.subtitle ? `<p class="uok-subtitle">${xmlText(document.subtitle)}</p>` : ""}
    ${generated}
  </header>
  ${sections}
</body>
</html>`;
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

function htmlSection(section: HtmlDocumentSection) {
  const paragraphs = (section.paragraphs || []).map((paragraph) => `<p>${xmlText(paragraph)}</p>`).join("");
  const definitionList = section.definitionList?.length
    ? `<dl>${section.definitionList.map(([label, value]) => `<dt>${xmlText(label)}</dt><dd>${xmlText(value)}</dd>`).join("")}</dl>`
    : "";
  const tables = (section.tables || []).map((table) => htmlTable(table)).join("");
  return `<section>
  <h2>${xmlText(section.heading)}</h2>
  ${paragraphs}
  ${definitionList}
  ${tables}
</section>`;
}

function htmlTable(table: HtmlDocumentTable) {
  const caption = table.caption ? `<caption>${xmlText(table.caption)}</caption>` : "";
  const headers = table.headers.map((header) => `<th scope="col">${xmlText(header)}</th>`).join("");
  const rows = table.rows.map((row) => `<tr>${row.map((cell) => `<td>${xmlText(cell)}</td>`).join("")}</tr>`).join("");
  return `<table>
  ${caption}
  <thead><tr>${headers}</tr></thead>
  <tbody>${rows || `<tr><td colspan="${table.headers.length}">No rows</td></tr>`}</tbody>
</table>`;
}

function safeExportSlug(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
}
