import { Archive, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { ConfirmCommandButton } from "../../shared/actions";
import { InlineTextEdit } from "../../shared/forms";
import { CommandButton } from "../../shared/primitives";
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
  onInlineUpdate
}: Pick<ContactsWorkspaceProps, "editing" | "onEdit" | "onArchive" | "onRestore" | "onPurge" | "onInlineUpdate"> & {
  contact: ContactsWorkspaceProps["selectedContact"];
}) {
  return (
    <div className="contact-detail-header">
      <div className="contact-detail-identity">
        {contact && <span className="contact-detail-avatar">{contactInitial(contact.display_name)}</span>}
        <div className="contact-detail-heading">
          {contact && !editing ? (
            <InlineTextEdit
              label="Display name"
              value={contact.display_name}
              validate={(value) => value ? "" : "Display name cannot be blank."}
              onCommit={(value) => onInlineUpdate("display_name", value)}
            />
          ) : (
            <h3>{contact?.display_name || "New contact"}</h3>
          )}
          {contact && <p>{contactSubtitle(contact)}</p>}
          {contact && <ContactStateStack contact={contact} />}
        </div>
      </div>
      {contact && !editing && (
        <div className="contact-inspector-actions">
          <CommandButton icon={Pencil} onClick={onEdit}>Edit</CommandButton>
          <details className="contact-manage-disclosure">
            <summary aria-label="Manage contact">
              <MoreHorizontal size={18} aria-hidden="true" />
              <span>Manage</span>
            </summary>
            <div className="contact-manage-actions">
              {contact.status === "archived" ? (
                <CommandButton icon={RotateCcw} onClick={onRestore}>Restore</CommandButton>
              ) : (
                <CommandButton icon={Archive} onClick={onArchive}>Archive</CommandButton>
              )}
              <ConfirmCommandButton
                icon={Trash2}
                message={`Permanently purge ${contact.display_name || "this contact"}? This cannot be undone.`}
                onConfirm={onPurge}
                destructive
              >
                Purge
              </ConfirmCommandButton>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
