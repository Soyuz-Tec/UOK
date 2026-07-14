import { DatabaseZap } from "lucide-react";

import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";

export function ContactDataToolsSection({ onOpen, canGovern }: { onOpen: () => void; canGovern: boolean }) {
  const { t } = useUokLocalization();
  return (
    <section className="search-workspace-section contacts-tools-section" aria-label={t("contacts.dataTools.section", "Data and governance") }>
      <h3><DatabaseZap size={16} aria-hidden="true" /> {t("contacts.dataTools.section", "Data and governance")}</h3>
      <p>{t("contacts.dataTools.hint", "Review governed facts, privacy, exchange, duplicate, and interoperability controls.")}</p>
      <CommandButton icon={DatabaseZap} onClick={onOpen}>
        {t("contacts.dataTools.open", "Data and governance")}
      </CommandButton>
      {!canGovern ? <small>{t("contacts.dataTools.readOnlyHint", "Your role can review supported data controls; governed changes remain disabled.")}</small> : null}
    </section>
  );
}
