import { useEffect, useMemo, useState } from "react";
import { Archive, Download, FileCheck2, FileUp, RotateCcw, UsersRound } from "lucide-react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactDownload, ContactImportResult, ContactImportRow, ContactTeamRow } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";
import { toggleSelectedId } from "./contactDataToolsUi";

const mappingTargets = ["display_name", "email", "phone", "organization_name", "title", "address"];

export function ContactExchangeToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [format, setFormat] = useState<"csv" | "vcard">("csv");
  const [sourceName, setSourceName] = useState("contacts.csv");
  const [sourceText, setSourceText] = useState("");
  const [importMode, setImportMode] = useState("create");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ContactImportResult | null>(null);
  const [importRows, setImportRows] = useState<ContactImportRow[]>([]);
  const [executedBatchId, setExecutedBatchId] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [teams, setTeams] = useState<ContactTeamRow[]>([]);
  const [bulkAction, setBulkAction] = useState("add_tag");
  const [bulkValue, setBulkValue] = useState("");
  const headers = useMemo(() => format === "csv" ? parseCsvHeader(sourceText) : [], [format, sourceText]);

  useEffect(() => {
    if (!props.canGovern) return;
    props.api.teams().then(setTeams).catch(() => setTeams([]));
  }, [props.api, props.canGovern]);

  useEffect(() => {
    if (!headers.length) return;
    setMapping((current) => {
      const next = { ...current };
      for (const target of mappingTargets) {
        if (next[target] && headers.includes(next[target])) continue;
        const normalizedTarget = target.replaceAll("_", "");
        const match = headers.find((header) => header.toLocaleLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTarget)
          || (target === "display_name" ? headers.find((header) => /^(full ?name|name)$/i.test(header)) : undefined);
        if (match) next[target] = match;
      }
      return next;
    });
  }, [headers.join("|")]);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setSourceName(file.name);
    setFormat(file.name.toLocaleLowerCase().endsWith(".vcf") ? "vcard" : "csv");
    setSourceText(await file.text());
    setImportResult(null);
    setImportRows([]);
  };

  const importContacts = async (dryRun: boolean) => {
    if (!sourceText.trim()) return;
    const operation = format === "csv"
      ? () => props.api.importCsv({ filename: sourceName || "contacts.csv", csv_text: sourceText, dry_run: dryRun, mode: importMode, mapping: compactMapping(mapping) })
      : () => props.api.importVcard({ vcard_text: sourceText, dry_run: dryRun });
    const result = await props.run(dryRun ? "import-preview" : "import-execute", operation, dryRun ? t("contacts.dataTools.previewReady", "Import preview is ready.") : t("contacts.dataTools.importCompleted", "Contact import completed."));
    if (!result) return;
    setImportResult(result);
    if (!dryRun) setExecutedBatchId(result.batch_id);
    setImportRows(await props.api.importRows(result.batch_id));
    if (!dryRun) await props.onChanged();
  };

  const rollbackImport = async () => {
    if (!executedBatchId) return;
    const result = await props.run("import-rollback", () => props.api.rollbackImport(executedBatchId), t("contacts.dataTools.importRolledBack", "Imported contacts were rolled back."));
    if (!result) return;
    setImportResult(result);
    setImportRows(await props.api.importRows(executedBatchId));
    await props.onChanged();
  };

  const exportContacts = async (exportFormat: "csv" | "vcf") => {
    const result = await props.run(`export-${exportFormat}`, () => props.api.exportContacts(exportFormat, props.selectedIds));
    if (!result) return;
    saveDownload(result);
    setExportStatus(result.restrictedCount
      ? t("contacts.dataTools.exportRestricted", `${result.restrictedCount} consent-restricted contacts were excluded or redacted.`)
      : t("contacts.dataTools.exportReady", "Consent-aware export is ready."));
  };

  const applyBulk = async () => {
    if (!props.selectedIds.length || (bulkNeedsValue(bulkAction) && !bulkValue.trim())) return;
    const result = await props.run("bulk-action", () => props.api.bulk(props.selectedIds, bulkAction, bulkValue), t("contacts.dataTools.bulkCompleted", "Bulk contact action completed."));
    if (!result) return;
    await props.onChanged();
  };

  const selectAllVisible = () => {
    props.onSelectedIdsChange(props.selectedIds.length === props.contacts.length ? [] : props.contacts.map((contact) => contact.id));
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.exchange", "Import, export and bulk") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.exchangeGovernance", "Governed exchange")}</p><h3>{t("contacts.dataTools.exchange", "Import, export and bulk")}</h3></div><strong>{props.selectedIds.length} {t("contacts.dataTools.selected", "selected")}</strong></header>
      <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.contactSelection", "Contact selection") }>
        <div className="contact-data-tools-subsection-heading"><h4>{t("contacts.dataTools.contactSelection", "Contact selection")}</h4><button type="button" onClick={selectAllVisible}>{props.selectedIds.length === props.contacts.length && props.contacts.length ? t("contacts.dataTools.clearSelection", "Clear selection") : t("contacts.dataTools.selectVisible", "Select visible")}</button></div>
        <div className="contact-data-tools-check-grid">
          {props.contacts.map((contact) => <label key={contact.id}><input type="checkbox" checked={props.selectedIds.includes(contact.id)} onChange={() => props.onSelectedIdsChange(toggleSelectedId(props.selectedIds, contact.id))} /><span>{contact.display_name}</span></label>)}
        </div>
      </section>
      <div className="contact-data-tools-columns">
        <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.guidedImport", "Guided import") }>
          <h4>{t("contacts.dataTools.guidedImport", "Guided import")}</h4>
          <p>{t("contacts.dataTools.importHint", "Preview validates every row without creating contacts. Execute only after reviewing the results.")}</p>
          <label className="contact-data-tools-file"><span>{t("contacts.dataTools.importFile", "CSV or vCard file")}</span><input type="file" accept=".csv,text/csv,.vcf,text/vcard" onChange={(event) => void loadFile(event.target.files?.[0])} disabled={!props.canGovern} /></label>
          <label><span>{t("contacts.dataTools.format", "Format")}</span><select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "vcard")} disabled={!props.canGovern}><option value="csv">CSV</option><option value="vcard">vCard</option></select></label>
          {format === "csv" ? <label><span>{t("contacts.dataTools.importMode", "Import mode")}</span><select value={importMode} onChange={(event) => setImportMode(event.target.value)} disabled={!props.canGovern}><option value="create">Create</option><option value="update">Update matching</option><option value="upsert">Create or update</option></select></label> : null}
          <label><span>{t("contacts.dataTools.sourcePreview", "Source preview")}</span><textarea rows={5} value={sourceText} onChange={(event) => setSourceText(event.target.value)} disabled={!props.canGovern} placeholder={format === "csv" ? "Name,Email\nAda,ada@example.com" : "BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nEND:VCARD"} /></label>
          {format === "csv" && headers.length ? <div className="contact-data-tools-mapping" aria-label={t("contacts.dataTools.columnMapping", "CSV column mapping") }><strong>{t("contacts.dataTools.columnMapping", "CSV column mapping")}</strong>{mappingTargets.map((target) => <label key={target}><span>{target.replaceAll("_", " ")}</span><select value={mapping[target] || ""} onChange={(event) => setMapping({ ...mapping, [target]: event.target.value })} disabled={!props.canGovern}><option value="">Not mapped</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}</div> : null}
          <div className="contact-data-tools-button-row">
            <CommandButton icon={FileCheck2} onClick={() => void importContacts(true)} disabled={!props.canGovern || !sourceText.trim()} loading={props.busyAction === "import-preview"}>{t("contacts.dataTools.preview", "Preview")}</CommandButton>
            <CommandButton icon={FileUp} primary onClick={() => void importContacts(false)} disabled={!props.canGovern || !sourceText.trim()} loading={props.busyAction === "import-execute"}>{t("contacts.dataTools.executeImport", "Execute import")}</CommandButton>
            {executedBatchId && props.canRestore ? <ConfirmCommandButton icon={RotateCcw} message={t("contacts.dataTools.rollbackImportConfirm", "Rollback the contacts created by this import batch?")} onConfirm={() => void rollbackImport()} disabled={Boolean(props.busyAction)} destructive>{t("contacts.dataTools.rollbackImport", "Rollback import")}</ConfirmCommandButton> : null}
          </div>
          {importResult ? <ImportSummary result={importResult} rows={importRows} /> : null}
        </section>
        <div className="contact-data-tools-column-stack">
          <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.export", "Consent-aware export") }>
            <h4>{t("contacts.dataTools.export", "Consent-aware export")}</h4>
            <p>{props.selectedIds.length ? t("contacts.dataTools.exportSelectedHint", "Export uses the selected contacts and excludes restricted records.") : t("contacts.dataTools.exportAllHint", "No contacts are selected; export uses every readable contact and excludes restricted records.")}</p>
            <div className="contact-data-tools-button-row"><CommandButton icon={Download} onClick={() => void exportContacts("csv")} disabled={!props.canGovern} loading={props.busyAction === "export-csv"}>CSV</CommandButton><CommandButton icon={Download} onClick={() => void exportContacts("vcf")} disabled={!props.canGovern} loading={props.busyAction === "export-vcf"}>vCard</CommandButton></div>
            {exportStatus ? <p role="status">{exportStatus}</p> : null}
          </section>
          <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.bulkActions", "Bulk actions") }>
            <h4>{t("contacts.dataTools.bulkActions", "Bulk actions")}</h4>
            <label><span>{t("contacts.dataTools.action", "Action")}</span><select value={bulkAction} onChange={(event) => { setBulkAction(event.target.value); setBulkValue(""); }} disabled={!props.canGovern}><option value="add_tag">Add tag</option><option value="assign_team">Assign team</option><option value="add_to_group">Add to group</option><option value="archive">Archive</option><option value="restore">Restore</option></select></label>
            {bulkAction === "assign_team" ? <label><span>{t("contacts.dataTools.team", "Team")}</span><select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} disabled={!props.canGovern}><option value="">Select team</option>{teams.filter((team) => team.status === "active").map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : null}
            {bulkAction === "add_to_group" ? <label><span>{t("contacts.dataTools.group", "Group")}</span><select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} disabled={!props.canGovern}><option value="">Select manual group</option>{props.groups.filter((group) => group.kind === "manual" && group.status === "active").map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label> : null}
            {bulkAction === "add_tag" ? <label><span>{t("contacts.dataTools.tag", "Tag")}</span><input value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} disabled={!props.canGovern} /></label> : null}
            {bulkAction === "archive" ? <ConfirmCommandButton icon={Archive} message={t("contacts.dataTools.archiveSelectedConfirm", "Archive the selected contacts?")} onConfirm={() => void applyBulk()} disabled={!props.canGovern || !props.selectedIds.length || Boolean(props.busyAction)} destructive>{t("contacts.dataTools.applyToSelected", "Apply to selected")}</ConfirmCommandButton> : <CommandButton icon={bulkAction === "restore" ? RotateCcw : UsersRound} primary onClick={() => void applyBulk()} disabled={!props.canGovern || !props.selectedIds.length || (bulkNeedsValue(bulkAction) && !bulkValue.trim())} loading={props.busyAction === "bulk-action"}>{t("contacts.dataTools.applyToSelected", "Apply to selected")}</CommandButton>}
          </section>
        </div>
      </div>
    </section>
  );
}

function ImportSummary({ result, rows }: { result: ContactImportResult; rows: ContactImportRow[] }) {
  const rolledBack = result.rolled_back_count !== undefined;
  const heading = rolledBack ? "Rolled back" : result.dry_run ? "Preview" : "Executed";
  return <div className="contact-data-tools-import-summary" role="status"><strong>{heading} · {result.batch_id}</strong><span>{rolledBack ? `${result.rolled_back_count || 0} rolled back${result.already_rolled_back ? " · already completed" : ""}` : `${result.validated_count || 0} validated · ${result.imported_count || 0} imported · ${result.updated_count || 0} updated · ${result.skipped_count || 0} skipped · ${result.failed_count || 0} failed${result.result_truncated ? " · detailed results truncated" : ""}`}</span>{rows.length ? <ol>{rows.slice(0, 12).map((row) => <li key={row.id}>Row {row.row_number}: {row.status}{row.error_message ? ` · ${row.error_message}` : ""}</li>)}</ol> : null}</div>;
}

function compactMapping(mapping: Record<string, string>) {
  return Object.fromEntries(Object.entries(mapping).filter(([, value]) => value));
}

function bulkNeedsValue(action: string) {
  return ["assign_team", "add_to_group", "add_tag"].includes(action);
}

function parseCsvHeader(text: string) {
  const line = text.split(/\r?\n/, 1)[0] || "";
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { result.push(value.trim()); value = ""; }
    else value += char;
  }
  result.push(value.trim());
  return result.filter(Boolean).slice(0, 100);
}

function saveDownload(download: ContactDownload) {
  const createObjectUrl = URL.createObjectURL?.bind(URL);
  if (!createObjectUrl) return;
  const objectUrl = createObjectUrl(download.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = download.filename;
  link.click();
  URL.revokeObjectURL?.(objectUrl);
}
