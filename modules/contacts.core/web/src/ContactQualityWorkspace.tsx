import { CheckCircle2, ClipboardList, FileCheck2, GitMerge, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactMergeFieldChoices } from "./contracts";
import { ContactDuplicateComparisonPopup } from "./ContactDuplicateComparisonPopup";
import { ContactReviewGuidance } from "./ContactReviewGuidance";
import { contactQualityActions, contactQualityGroups, contactPrimaryQualityIssue, duplicateMatches } from "./contactQuality";
import { contactInitial, contactSubtitle } from "./contactPresentation";
import type { ContactsWorkspaceProps } from "./types";

export function ContactQualityWorkspace({
  onOpenEditor,
  ...props
}: ContactsWorkspaceProps & {
  onOpenEditor: () => void;
}) {
  const { t } = useUokLocalization();
  const groups = useMemo(() => contactQualityGroups(props.contacts), [props.contacts]);
  const selected = props.selectedContact;
  const selectedIssue = selected ? contactPrimaryQualityIssue(selected) : null;
  const matches = selected ? duplicateMatches(selected, props.contacts) : [];
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const reviewContact = (id: string) => {
    props.onSelect(id);
  };

  const editSelected = () => {
    if (!selected) return;
    props.onEdit();
    onOpenEditor();
  };

  const openMatch = (id: string) => {
    props.onSelect(id);
    setComparisonOpen(false);
  };

  const mergeDuplicate = async (primaryContactId: string, duplicateContactId: string, fieldChoices?: ContactMergeFieldChoices) => {
    await props.onMergeDuplicate(primaryContactId, duplicateContactId, fieldChoices);
    setComparisonOpen(false);
  };

  return (
    <section className="contact-quality-workspace" aria-label="Contact quality workspace">
      <div className="quality-queue" aria-label="Contact quality queue">
        <div className="quality-queue-header">
          <div>
            <p className="eyebrow">Review queue</p>
            <h2>Contact quality</h2>
          </div>
          <span>{props.contacts.length} visible</span>
        </div>
        <div className="quality-groups">
          {groups.map((group) => (
            <section className="quality-group" key={group.id} aria-label={group.title}>
              <div className="quality-group-header">
                <div>
                  <strong>{group.title}</strong>
                  <p>{group.description}</p>
                </div>
                <span>{group.contacts.length}</span>
              </div>
              {group.contacts.length ? (
                <div className="quality-contact-list">
                  {group.contacts.map((contact) => (
                    <button
                      type="button"
                      key={contact.id}
                      className={props.selectedContactId === contact.id ? "quality-contact selected" : "quality-contact"}
                      aria-pressed={props.selectedContactId === contact.id}
                      onClick={() => reviewContact(contact.id)}
                    >
                      <span className="contact-avatar">{contactInitial(contact.display_name)}</span>
                      <span className="contact-name-stack">
                        <strong>{contact.display_name}</strong>
                        <small>{contactSubtitle(contact)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="quality-empty">No contacts in this group.</p>
              )}
            </section>
          ))}
        </div>
      </div>

      <aside className="quality-guide" aria-label="Guided contact fixes">
        {selected ? (
          <>
            <div className="quality-guide-header">
              <span className="record-profile-avatar compact">{contactInitial(selected.display_name)}</span>
              <div className="contact-name-stack">
                <p className="eyebrow">Guided fix</p>
                <h2>{selected.display_name}</h2>
                <small>{selectedIssue?.replaceAll("_", " ")}</small>
              </div>
            </div>
            <ContactReviewGuidance contact={selected} />
            <section className="quality-action-panel" aria-label="Suggested contact actions">
              <div className="quality-action-title">
                <ClipboardList size={18} aria-hidden="true" />
                <strong>Suggested actions</strong>
              </div>
              <ol>
                {contactQualityActions(selected).map((action) => <li key={action}>{action}</li>)}
              </ol>
              <div className="quality-command-grid">
                <CommandButton icon={Pencil} onClick={editSelected}>Edit contact</CommandButton>
                <CommandButton icon={StickyNote} onClick={() => props.onDetailPaneChange("activity")}>Add purpose note</CommandButton>
                <CommandButton icon={GitMerge} onClick={() => setComparisonOpen(true)} disabled={!matches.length && !(selected.duplicate_candidates || []).length}>Compare duplicates</CommandButton>
                <CommandButton icon={CheckCircle2} onClick={props.onMarkReady} disabled={selected.review_state === "ready"} primary>Mark ready</CommandButton>
                {selected.can_delete === true ? <ConfirmCommandButton
                  key={`${selected.id}:${selected.status}:delete`}
                  icon={Trash2}
                  message={`${t("contacts.deletePrefix", "Delete")} “${selected.display_name}” ${t("contacts.deleteImpact", "from active use? The contact will leave active records, but its notes, group memberships, and audit history remain. Restore it from Archived at any time.")}`}
                  dialogLabel={t("contacts.deleteConfirm", "Confirm contact deletion")}
                  title={`${t("contacts.deletePrefix", "Delete")} “${selected.display_name}”?`}
                  confirmLabel={t("command.delete", "Delete")}
                  onConfirm={props.onArchive}
                  disabled={Boolean(props.busyAction)}
                  loading={props.busyAction === "ArchiveContact"}
                  destructive
                >
                  {t("contacts.deleteIrrelevant", "Delete irrelevant contact")}
                </ConfirmCommandButton> : null}
              </div>
            </section>
            <section className="quality-note-composer">
              <label className="field">
                <span>Purpose note</span>
                <input value={props.noteText} onChange={(event) => props.onNoteTextChange(event.target.value)} placeholder="Why this contact exists in UOK" />
              </label>
              <CommandButton icon={FileCheck2} onClick={props.onAddNote} disabled={!props.noteText.trim()}>Add note</CommandButton>
            </section>
          </>
        ) : (
          <EmptyState text="Select a contact from the quality queue." />
        )}
      </aside>

      <ContactDuplicateComparisonPopup
        open={comparisonOpen}
        contact={selected}
        matches={matches}
        mergeBusy={props.busyAction === "MergeDuplicateContact"}
        onClose={() => setComparisonOpen(false)}
        onMerge={(primaryContactId, duplicateContactId, fieldChoices) => void mergeDuplicate(primaryContactId, duplicateContactId, fieldChoices)}
        onOpenMatch={openMatch}
      />
    </section>
  );
}
