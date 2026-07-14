import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactConsentRow, ContactConsentWrite } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

type ConsentDraft = ContactConsentWrite & { evidence_reference: string; effective_date: string; expires_date: string };

const emptyConsent: ConsentDraft = {
  purpose: "directory_export",
  channel: "any",
  status: "pending",
  legal_basis: "unspecified",
  allowed_use: "",
  source: "manual",
  evidence_reference: "",
  effective_date: "",
  expires_date: "",
};

export function ContactConsentToolsPanel(props: ContactDataToolsPanelProps) {
  const { t, formatDate } = useUokLocalization();
  const [rows, setRows] = useState<ContactConsentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ConsentDraft>(emptyConsent);
  const partyId = props.selectedContact?.id || "";

  useEffect(() => {
    let active = true;
    if (!partyId || !props.canGovern) {
      setRows([]);
      return;
    }
    setLoading(true);
    props.api.consents(partyId)
      .then((result) => { if (active) setRows(result); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [partyId, props.api, props.canGovern]);

  const recordConsent = async () => {
    if (!partyId) return;
    const payload: ContactConsentWrite = {
      purpose: draft.purpose,
      channel: draft.channel,
      status: draft.status,
      legal_basis: draft.legal_basis,
      allowed_use: draft.allowed_use,
      source: draft.source,
      effective_at: utcDate(draft.effective_date),
      expires_at: utcDate(draft.expires_date),
      evidence: draft.evidence_reference ? { reference: draft.evidence_reference } : {},
    };
    const result = await props.run("consent-record", () => props.api.recordConsent(partyId, payload), t("contacts.dataTools.consentRecorded", "Consent decision recorded."));
    if (!result) return;
    setDraft(emptyConsent);
    setRows(await props.api.consents(partyId));
    await props.onChanged();
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.consent", "Consent history") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.appendOnly", "Append-only governance")}</p><h3>{t("contacts.dataTools.consent", "Consent history")}</h3></div>{props.selectedContact ? <strong>{props.selectedContact.display_name}</strong> : null}</header>
      {!props.selectedContact ? <EmptyState text={t("contacts.dataTools.selectContact", "Select a contact before managing record-level data.")} /> : !props.canGovern ? (
        <p className="contact-data-tools-permission" role="note">{t("contacts.dataTools.consentPermission", "Consent records require the Contacts consent permission and are not exposed to this role.")}</p>
      ) : (
        <>
          {loading ? <p role="status">{t("contacts.dataTools.loadingConsent", "Loading consent history...")}</p> : rows.length ? (
            <div className="contact-data-tools-record-list" role="list" aria-label={t("contacts.dataTools.consentList", "Recorded consent decisions") }>
              {rows.map((row) => (
                <article className="contact-data-tools-record" role="listitem" key={row.id}>
                  <div><strong>{row.status} · {row.channel}</strong><span>{row.purpose} · {row.legal_basis}</span><small>{row.effective_at ? formatDate(row.effective_at) : row.source}{row.expires_at ? ` · ${t("contacts.dataTools.expires", "Expires")} ${formatDate(row.expires_at)}` : ""}</small></div>
                </article>
              ))}
            </div>
          ) : <p className="contact-data-tools-empty">{t("contacts.dataTools.noConsent", "No consent decision has been recorded.")}</p>}
          <fieldset className="contact-data-tools-form" disabled={Boolean(props.busyAction)}>
            <legend>{t("contacts.dataTools.recordConsent", "Record a consent decision")}</legend>
            <label><span>{t("contacts.dataTools.purpose", "Purpose")}</span><select value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })}>{["directory_export", "business_operations", "all"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            <label><span>{t("contacts.dataTools.channel", "Channel")}</span><select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value })}>{["any", "email", "in_person", "phone", "post", "sms"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            <label><span>{t("contacts.dataTools.status", "Status")}</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{["pending", "granted", "denied", "revoked"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>{t("contacts.dataTools.legalBasis", "Legal basis")}</span><select value={draft.legal_basis} onChange={(event) => setDraft({ ...draft, legal_basis: event.target.value })}>{["unspecified", "consent", "contract", "legal_obligation", "legitimate_interest"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            <label><span>{t("contacts.dataTools.allowedUse", "Allowed use")}</span><input value={draft.allowed_use} onChange={(event) => setDraft({ ...draft, allowed_use: event.target.value })} /></label>
            <label><span>{t("contacts.dataTools.source", "Source")}</span><input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
            <label><span>{t("contacts.dataTools.effectiveDate", "Effective date")}</span><input type="date" value={draft.effective_date} onChange={(event) => setDraft({ ...draft, effective_date: event.target.value })} /></label>
            <label><span>{t("contacts.dataTools.expiryDate", "Expiry date")}</span><input type="date" value={draft.expires_date} onChange={(event) => setDraft({ ...draft, expires_date: event.target.value })} /></label>
            <label className="wide"><span>{t("contacts.dataTools.evidenceReference", "Evidence reference")}</span><input value={draft.evidence_reference} onChange={(event) => setDraft({ ...draft, evidence_reference: event.target.value })} /></label>
            <p className="wide contact-data-tools-form-hint">{t("contacts.dataTools.exportConsentHint", "A denied or revoked directory-export decision excludes the contact, or redacts the matching email, phone, SMS, or postal channel from CSV and vCard exports.")}</p>
            <div className="contact-data-tools-form-actions wide"><CommandButton icon={ShieldCheck} primary onClick={() => void recordConsent()} loading={props.busyAction === "consent-record"} disabled={!draft.purpose.trim() || !draft.channel.trim() || !draft.status.trim()}>{t("contacts.dataTools.recordConsent", "Record a consent decision")}</CommandButton></div>
          </fieldset>
        </>
      )}
    </section>
  );
}

function utcDate(value: string) {
  return value ? `${value}T00:00:00Z` : null;
}
