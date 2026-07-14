import { UsersRound } from "lucide-react";

import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";

export function ContactGroupsToolsSection({ onOpen }: { onOpen: () => void }) {
  const { t } = useUokLocalization();
  return (
    <section className="search-workspace-section contacts-tools-section" aria-label={t("contacts.tools", "Contacts tools")}>
      <h3><UsersRound size={16} aria-hidden="true" /> {t("contacts.tools", "Contacts tools")}</h3>
      <p>{t("contacts.groups.toolsHint", "Manage manual groups and review generated working sets.")}</p>
      <CommandButton icon={UsersRound} onClick={onOpen}>{t("contacts.groups.manager", "Groups manager")}</CommandButton>
    </section>
  );
}
