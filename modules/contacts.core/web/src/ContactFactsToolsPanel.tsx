import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactFactRow, ContactFactWrite } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

const emptyFact: ContactFactWrite = {
  fact_type: "email",
  label: "work",
  value: "",
  is_primary: false,
  is_verified: false,
  source: "manual",
  confidence: "unknown",
};

export function ContactFactsToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [rows, setRows] = useState<ContactFactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ContactFactWrite>(emptyFact);
  const partyId = props.selectedContact?.id || "";

  useEffect(() => {
    let active = true;
    if (!partyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    props.api.facts(partyId)
      .then((result) => { if (active) setRows(result); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [partyId, props.api]);

  const reload = async () => {
    if (partyId) setRows(await props.api.facts(partyId));
  };

  const addFact = async () => {
    if (!partyId || !draft.value.trim()) return;
    const result = await props.run("fact-add", () => props.api.addFact(partyId, draft), t("contacts.dataTools.factAdded", "Contact fact added."));
    if (!result) return;
    setDraft({ ...emptyFact, fact_type: draft.fact_type, label: draft.label });
    await reload();
    await props.onChanged();
  };

  const removeFact = async (row: ContactFactRow) => {
    const result = await props.run("fact-remove", () => props.api.removeFact(partyId, row.id), t("contacts.dataTools.factRemoved", "Contact fact removed."));
    if (!result) return;
    await reload();
    await props.onChanged();
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.facts", "Contact facts") }>
      <header>
        <div><p className="eyebrow">{t("contacts.dataTools.governedRecord", "Governed record")}</p><h3>{t("contacts.dataTools.facts", "Contact facts")}</h3></div>
        {props.selectedContact ? <strong>{props.selectedContact.display_name}</strong> : null}
      </header>
      {!props.selectedContact ? <EmptyState text={t("contacts.dataTools.selectContact", "Select a contact before managing record-level data.")} /> : (
        <>
          {loading ? <p role="status">{t("contacts.dataTools.loadingFacts", "Loading contact facts...")}</p> : rows.length ? (
            <div className="contact-data-tools-record-list" role="list" aria-label={t("contacts.dataTools.factList", "Stored contact facts") }>
              {rows.map((row) => (
                <article className="contact-data-tools-record" role="listitem" key={row.id}>
                  <div>
                    <strong>{row.value}</strong>
                    <span>{row.fact_type} · {row.label}{row.is_primary ? ` · ${t("contacts.dataTools.primary", "Primary")}` : ""}</span>
                    <small>{row.source} · {row.confidence}{row.is_verified ? ` · ${t("contacts.dataTools.verified", "Verified")}` : ""}</small>
                  </div>
                  {props.canGovern ? (
                    <ConfirmCommandButton icon={Trash2} message={t("contacts.dataTools.removeFactConfirm", "Remove this contact fact?")} onConfirm={() => void removeFact(row)} destructive disabled={Boolean(props.busyAction)}>
                      {t("command.remove", "Remove")}
                    </ConfirmCommandButton>
                  ) : null}
                </article>
              ))}
            </div>
          ) : <p className="contact-data-tools-empty">{t("contacts.dataTools.noFacts", "No first-class contact facts are stored yet.")}</p>}
          <fieldset className="contact-data-tools-form" disabled={!props.canGovern || Boolean(props.busyAction)}>
            <legend>{t("contacts.dataTools.addFact", "Add contact fact")}</legend>
            <label><span>{t("contacts.dataTools.factType", "Fact type")}</span><select value={draft.fact_type} onChange={(event) => setDraft({ ...draft, fact_type: event.target.value })}>
              {factTypes.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}
            </select></label>
            <label><span>{t("contacts.dataTools.label", "Label")}</span><input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
            <label className="wide"><span>{t("contacts.dataTools.value", "Value")}</span><input value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></label>
            <label><span>{t("contacts.dataTools.source", "Source")}</span><input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
            <label><span>{t("contacts.dataTools.confidence", "Confidence")}</span><select value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: event.target.value })}>
              {confidenceValues.map((value) => <option value={value} key={value}>{value}</option>)}
            </select></label>
            <label className="check"><input type="checkbox" checked={draft.is_primary} onChange={(event) => setDraft({ ...draft, is_primary: event.target.checked })} /><span>{t("contacts.dataTools.primary", "Primary")}</span></label>
            <label className="check"><input type="checkbox" checked={draft.is_verified} onChange={(event) => setDraft({ ...draft, is_verified: event.target.checked })} /><span>{t("contacts.dataTools.verified", "Verified")}</span></label>
            <div className="contact-data-tools-form-actions wide"><CommandButton icon={Plus} primary onClick={() => void addFact()} disabled={!draft.value.trim()} loading={props.busyAction === "fact-add"}>{t("contacts.dataTools.addFact", "Add contact fact")}</CommandButton></div>
          </fieldset>
        </>
      )}
    </section>
  );
}

const factTypes = ["email", "phone", "address", "url", "date", "instant_message", "tag"];
const confidenceValues = ["unknown", "low", "medium", "high", "verified"];
