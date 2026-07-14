import { useEffect, useState } from "react";
import { Link2, Puzzle } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactExternalIdentity, ContactInteroperabilityStatus } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

export function ContactInteroperabilityToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [status, setStatus] = useState<ContactInteroperabilityStatus | null>(null);
  const [identities, setIdentities] = useState<ContactExternalIdentity[]>([]);
  const [provider, setProvider] = useState("google");
  const [externalId, setExternalId] = useState("");
  const partyId = props.selectedContact?.id || "";

  const loadIdentities = async () => {
    setIdentities(partyId ? await props.api.externalIdentities(partyId) : []);
  };

  useEffect(() => {
    let active = true;
    Promise.all([props.api.interoperability(), partyId ? props.api.externalIdentities(partyId) : Promise.resolve([])])
      .then(([nextStatus, nextIdentities]) => { if (active) { setStatus(nextStatus); setIdentities(nextIdentities); } })
      .catch(() => { if (active) { setStatus(null); setIdentities([]); } });
    return () => { active = false; };
  }, [partyId, props.api]);

  const linkIdentity = async () => {
    if (!partyId || !externalId.trim()) return;
    const result = await props.run("identity-link", () => props.api.linkExternalIdentity(partyId, { provider, external_id: externalId.trim(), sync_state: "linked" }), t("contacts.dataTools.identityLinked", "External identity linked."));
    if (!result) return;
    setExternalId("");
    await loadIdentities();
    await props.onChanged();
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.interoperability", "Interoperability") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.integrationBoundary", "Integration boundary")}</p><h3>{t("contacts.dataTools.interoperability", "Interoperability")}</h3></div><Puzzle size={22} aria-hidden="true" /></header>
      {status ? <>
        <p className="contact-data-tools-claim" role="note">{status.sync_claim}</p>
        <div className="contact-data-tools-columns">
          <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.exchangeFormats", "Exchange formats") }><h4>{t("contacts.dataTools.exchangeFormats", "Exchange formats")}</h4><div className="contact-data-tools-status-grid">{Object.entries(status.formats).map(([id, capability]) => <div key={id}><strong>{id.toUpperCase()}</strong><span>{capability.import ? t("contacts.dataTools.importReady", "Import ready") : t("contacts.dataTools.notAvailable", "Not available")}</span><span>{capability.export ? t("contacts.dataTools.exportReadyShort", "Export ready") : t("contacts.dataTools.notAvailable", "Not available")}</span></div>)}</div></section>
          <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.providerAdapters", "Provider adapters") }><h4>{t("contacts.dataTools.providerAdapters", "Provider adapters")}</h4><div className="contact-data-tools-status-grid">{status.providers.map((item) => <div key={item.id}><strong>{item.id}</strong><span>{item.adapter.replaceAll("_", " ")}</span><span>{item.configured ? t("contacts.dataTools.configured", "Configured") : t("contacts.dataTools.notConfigured", "Not configured")}</span></div>)}</div></section>
        </div>
      </> : <p role="status">{t("contacts.dataTools.loadingInterop", "Loading interoperability status...")}</p>}
      <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.externalIdentities", "External identities") }>
        <h4>{t("contacts.dataTools.externalIdentities", "External identities")}</h4>
        {!props.selectedContact ? <EmptyState text={t("contacts.dataTools.selectContact", "Select a contact before managing record-level data.")} /> : <>
          {identities.length ? <div className="contact-data-tools-record-list">{identities.map((identity) => <article className="contact-data-tools-record" key={identity.id}><div><strong>{identity.provider}</strong><span>{identity.external_id}</span><small>{identity.sync_state} · {identity.conflict_state}</small></div></article>)}</div> : <p className="contact-data-tools-empty">{t("contacts.dataTools.noExternalIdentities", "No provider identity is linked to this contact.")}</p>}
          {props.canGovern ? <div className="contact-data-tools-inline-form"><label><span>{t("contacts.dataTools.provider", "Provider")}</span><select value={provider} onChange={(event) => setProvider(event.target.value)}>{(status?.providers || [{ id: "google" }, { id: "microsoft" }, { id: "carddav" }]).map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><label><span>{t("contacts.dataTools.externalId", "External ID")}</span><input value={externalId} onChange={(event) => setExternalId(event.target.value)} /></label><CommandButton icon={Link2} onClick={() => void linkIdentity()} disabled={!externalId.trim()} loading={props.busyAction === "identity-link"}>{t("contacts.dataTools.linkIdentity", "Link identity")}</CommandButton></div> : null}
        </>}
      </section>
    </section>
  );
}
