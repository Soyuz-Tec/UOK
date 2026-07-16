import { MoreHorizontal, Pencil, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { RecordProfileHeader } from "@uok/shared/data-display";
import { InlineTextEdit } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import { ContactStateStack } from "./ContactResultState";
import { contactInitial, contactSubtitle } from "./contactPresentation";
import type { ContactsWorkspaceProps } from "./types";

export function ContactInspectorHeader({
  contact,
  editing,
  onEdit,
  onArchive,
  onRestore,
  onPurge,
  onInlineUpdate,
  busyAction
}: Pick<ContactsWorkspaceProps, "editing" | "onEdit" | "onArchive" | "onRestore" | "onPurge" | "onInlineUpdate" | "busyAction"> & {
  contact: ContactsWorkspaceProps["selectedContact"];
}) {
  const { t } = useUokLocalization();
  const actionsRef = useRef<HTMLDivElement>(null);
  const lifecycleIdentity = `${contact?.id || "none"}:${contact?.status || "missing"}`;
  const previousLifecycleRef = useRef(lifecycleIdentity);

  useEffect(() => {
    const previous = previousLifecycleRef.current;
    previousLifecycleRef.current = lifecycleIdentity;
    if (previous === lifecycleIdentity) return undefined;
    let focusFrame = 0;
    const settleFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.isConnected && active !== document.body) return;
        actionsRef.current?.querySelector<HTMLButtonElement>(".contact-lifecycle-action button, summary")?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [lifecycleIdentity]);
  const avatar = contact ? <span>{contactInitial(contact.display_name)}</span> : null;
  const title = contact && !editing ? (
    <InlineTextEdit
      label="Display name"
      value={contact.display_name}
      validate={(value) => value ? "" : "Display name cannot be blank."}
      onCommit={(value) => onInlineUpdate("display_name", value)}
    />
  ) : (
    <h3>{contact?.display_name || "New contact"}</h3>
  );
  const actions = contact && !editing ? (
    <div ref={actionsRef} className="contact-inspector-actions">
      <CommandButton icon={Pencil} onClick={onEdit}>Edit</CommandButton>
      <details className="contact-manage-disclosure">
        <summary aria-label="Manage contact">
          <MoreHorizontal size={18} aria-hidden="true" />
          <span>Manage</span>
        </summary>
        <div className="contact-manage-actions">
          {contact.status === "archived" && contact.can_restore === true ? (
            <span className="contact-lifecycle-action"><CommandButton icon={RotateCcw} onClick={onRestore} disabled={Boolean(busyAction)}>Restore</CommandButton></span>
          ) : contact.can_delete === true ? (
            <span className="contact-lifecycle-action"><ConfirmCommandButton
              key={`${contact.id}:${contact.status}:delete`}
              icon={Trash2}
              message={`${t("contacts.deletePrefix", "Delete")} “${contact.display_name || t("contacts.thisContact", "this contact")}” ${t("contacts.deleteImpact", "from active use? The contact will leave active records, but its notes, group memberships, and audit history remain. Restore it from Archived at any time.")}`}
              dialogLabel={t("contacts.deleteConfirm", "Confirm contact deletion")}
              title={`${t("contacts.deletePrefix", "Delete")} “${contact.display_name || t("contacts.thisContact", "this contact")}”?`}
              confirmLabel={t("command.delete", "Delete")}
              onConfirm={onArchive}
              disabled={Boolean(busyAction)}
              loading={busyAction === "ArchiveContact"}
              destructive
            >
              {t("command.delete", "Delete")}
            </ConfirmCommandButton></span>
          ) : null}
          {contact.can_purge === true ? <ConfirmCommandButton
            key={`${contact.id}:${contact.status}:purge`}
            icon={ShieldAlert}
            message={`Permanently purge ${contact.display_name || "this contact"}? This cannot be undone.`}
            dialogLabel={t("contacts.purgeConfirm", "Confirm permanent contact purge")}
            title={t("contacts.purgeTitle", "Purge contact permanently?")}
            confirmLabel={t("contacts.purge", "Purge")}
            onConfirm={onPurge}
            disabled={Boolean(busyAction)}
            loading={busyAction === "PurgeContact"}
            destructive
          >
            {t("contacts.purge", "Purge")}
          </ConfirmCommandButton>
          : null}
        </div>
      </details>
    </div>
  ) : null;

  return (
    <RecordProfileHeader
      className="contact-detail-header"
      avatar={avatar}
      title={title}
      subtitle={contact ? contactSubtitle(contact) : undefined}
      meta={contact ? <ContactStateStack contact={contact} /> : undefined}
      actions={actions}
    />
  );
}
