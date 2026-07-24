import { useEffect, useState } from "react";
import { GitCompareArrows, GitMerge, RefreshCw, RotateCcw, ShieldX } from "lucide-react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactDuplicateCandidateRow } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

export function ContactDuplicateToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<ContactDuplicateCandidateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!props.canGovern) return;
    setRows(await props.api.duplicates(status));
  };

  useEffect(() => {
    let active = true;
    if (!props.canGovern) {
      setRows([]);
      return;
    }
    setLoading(true);
    props.api.duplicates(status)
      .then((result) => { if (active) setRows(result); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [props.api, props.canGovern, status]);

  const refresh = async () => {
    const result = await props.run("duplicates-refresh", props.api.refreshDuplicates, t("contacts.dataTools.duplicatesRefreshed", "Duplicate candidates refreshed."));
    if (result) await load();
  };

  const resolve = async (candidate: ContactDuplicateCandidateRow, resolution: "not_duplicate" | "ignored") => {
    const result = await props.run("duplicate-resolve", () => props.api.resolveDuplicate(candidate.id, resolution, candidate.updated_at), t("contacts.dataTools.duplicateResolved", "Duplicate candidate resolved."));
    if (result) await load();
  };

  const merge = async (candidate: ContactDuplicateCandidateRow, keep: "left" | "right") => {
    const primaryId = keep === "left" ? candidate.left_party_id : candidate.right_party_id;
    const duplicateId = keep === "left" ? candidate.right_party_id : candidate.left_party_id;
    const result = await props.run("duplicate-merge", () => props.api.mergeDuplicate(primaryId, duplicateId), t("contacts.dataTools.duplicateMerged", "Duplicate contacts merged."));
    if (!result) return;
    await load();
    await props.onChanged();
  };

  const rollbackMerge = async (merge: { merge_id: string; duplicate_party_id?: string }) => {
    if (!props.selectedContact || !merge.duplicate_party_id) return;
    const result = await props.run("duplicate-rollback", () => props.api.rollbackMerge(props.selectedContact!.id, merge.duplicate_party_id!, merge.merge_id), t("contacts.dataTools.mergeRolledBack", "Duplicate merge rolled back."));
    if (result) await props.onChanged();
  };

  const mergeHistory = (props.selectedContact?.attrs.merge_history || []).filter((merge) => !merge.rolled_back_at && merge.duplicate_party_id && merge.merge_id);

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.duplicates", "Duplicate review") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.dataQuality", "Data quality")}</p><h3>{t("contacts.dataTools.duplicates", "Duplicate review")}</h3></div>{props.canGovern ? <CommandButton icon={RefreshCw} onClick={() => void refresh()} loading={props.busyAction === "duplicates-refresh"}>{t("command.refresh", "Refresh")}</CommandButton> : null}</header>
      {!props.canGovern ? <p className="contact-data-tools-permission" role="note">{t("contacts.dataTools.dedupePermission", "Duplicate evidence requires the Contacts deduplication permission.")}</p> : (
        <>
          <label className="contact-data-tools-compact-field"><span>{t("contacts.dataTools.resolutionStatus", "Resolution status")}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="not_duplicate">Not duplicate</option><option value="ignored">Ignored</option><option value="merged">Merged</option><option value="stale">Stale</option></select></label>
          {loading ? <p role="status">{t("contacts.dataTools.loadingDuplicates", "Loading duplicate candidates...")}</p> : rows.length ? (
            <div className="contact-data-tools-duplicate-list" role="list">
              {rows.map((candidate) => <article className="contact-data-tools-duplicate" role="listitem" key={candidate.id}>
                <div className="contact-data-tools-duplicate-heading"><GitCompareArrows size={18} aria-hidden="true" /><div><strong>{candidate.left_name} ↔ {candidate.right_name}</strong><span>{t("contacts.dataTools.matchScore", "Match score")} {candidate.score}% · {candidate.reasons.join(", ")}</span></div></div>
                {status === "open" ? <div className="contact-data-tools-button-row">
                  <ConfirmCommandButton icon={GitMerge} message={`${t("contacts.dataTools.keep", "Keep")} ${candidate.left_name} ${t("contacts.dataTools.mergeOther", "and merge the other contact into it?")}`} onConfirm={() => void merge(candidate, "left")} disabled={Boolean(props.busyAction)}>{t("contacts.dataTools.keep", "Keep")} {candidate.left_name}</ConfirmCommandButton>
                  <ConfirmCommandButton icon={GitMerge} message={`${t("contacts.dataTools.keep", "Keep")} ${candidate.right_name} ${t("contacts.dataTools.mergeOther", "and merge the other contact into it?")}`} onConfirm={() => void merge(candidate, "right")} disabled={Boolean(props.busyAction)}>{t("contacts.dataTools.keep", "Keep")} {candidate.right_name}</ConfirmCommandButton>
                  <CommandButton icon={ShieldX} onClick={() => void resolve(candidate, "not_duplicate")} disabled={Boolean(props.busyAction)}>{t("contacts.dataTools.notDuplicate", "Not duplicate")}</CommandButton>
                  <CommandButton icon={ShieldX} onClick={() => void resolve(candidate, "ignored")} disabled={Boolean(props.busyAction)}>{t("contacts.dataTools.ignore", "Ignore")}</CommandButton>
                </div> : null}
              </article>)}
            </div>
          ) : <EmptyState text={t("contacts.dataTools.noDuplicates", "No duplicate candidates match this status.")} />}
          {mergeHistory.length ? <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.mergeRecovery", "Merge recovery") }><h4>{t("contacts.dataTools.mergeRecovery", "Merge recovery")}</h4><p>{props.selectedContact?.display_name}</p>{mergeHistory.map((merge) => <div className="contact-data-tools-record" key={merge.merge_id}><div><strong>{merge.duplicate_display_name || merge.duplicate_party_id}</strong><span>{merge.merged_at || merge.merge_id}</span></div>{props.canRestore ? <ConfirmCommandButton icon={RotateCcw} message={t("contacts.dataTools.rollbackMergeConfirm", "Restore the duplicate and roll back this merge?")} onConfirm={() => void rollbackMerge(merge)} disabled={Boolean(props.busyAction)} destructive>{t("contacts.dataTools.rollbackMerge", "Rollback merge")}</ConfirmCommandButton> : null}</div>)}</section> : null}
        </>
      )}
    </section>
  );
}
