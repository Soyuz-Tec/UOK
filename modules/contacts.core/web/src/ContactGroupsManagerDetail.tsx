import { Plus, RotateCcw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmCommandButton, WorkspaceActionButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton, IconButton } from "@uok/shared/primitives";
import type { ContactGroupMemberRow, ManagedContactGroup } from "./contactGroupsManagerApi";

export function ContactGroupsManagerDetail({
  group,
  creating,
  name,
  description,
  members,
  candidates,
  candidateQuery,
  canManage,
  busyAction,
  focusRestore,
  onNameChange,
  onDescriptionChange,
  onCandidateQueryChange,
  onCreate,
  onCancelCreate,
  onSave,
  onArchive,
  onRestore,
  onAddMember,
  onRemoveMember
}: {
  group: ManagedContactGroup | null;
  creating: boolean;
  name: string;
  description: string;
  members: ContactGroupMemberRow[];
  candidates: ContactGroupMemberRow[];
  candidateQuery: string;
  canManage: boolean;
  busyAction: string;
  focusRestore: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCandidateQueryChange: (value: string) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  onSave: () => void;
  onArchive: () => void | Promise<void>;
  onRestore: () => void;
  onAddMember: (partyId: string) => void;
  onRemoveMember: (partyId: string) => void;
}) {
  const { t, formatNumber } = useUokLocalization();
  const [nextPartyId, setNextPartyId] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const availableCandidates = candidates.filter((candidate) => !memberIds.has(candidate.id));
  const isManual = creating || group?.user_managed === true;
  const isArchived = group?.status === "archived";
  const editable = Boolean(canManage && isManual && !isArchived);
  const controlsEnabled = editable && !busyAction;
  const dirty = creating
    ? Boolean(name.trim())
    : Boolean(group && (name.trim() !== group.name || description.trim() !== (group.description || "")));

  useEffect(() => {
    setNextPartyId("");
  }, [creating, group?.id]);

  useEffect(() => {
    if (!focusRestore || !isArchived) return;
    let restoreFrame = 0;
    const popupFrame = window.requestAnimationFrame(() => {
      restoreFrame = window.requestAnimationFrame(() => {
        detailRef.current?.querySelector<HTMLButtonElement>('[data-command="restore-group"]')?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(popupFrame);
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
    };
  }, [focusRestore, isArchived]);

  if (!creating && !group) {
    return <section className="contact-groups-manager-detail"><EmptyState text={t("contacts.groups.choose", "Choose a group to review it.")} /></section>;
  }

  return (
    <section ref={detailRef} className="contact-groups-manager-detail" aria-label={creating ? t("contacts.groups.create", "Create group") : t("contacts.groups.details", "Group details")}>
      <header className="contact-groups-manager-detail-heading">
        <div>
          <p className="eyebrow">{creating ? t("contacts.groups.manual", "Manual") : groupKindLabel(group, t)}</p>
          <h3 dir="auto">{creating ? t("contacts.groups.new", "New group") : group?.name}</h3>
          {!creating && group ? (
            <p>{formatNumber(group.active_member_count ?? group.member_count)} {t("contacts.groups.activeMembers", "active members")} - {group.status === "archived" ? t("contacts.groups.archived", "Archived") : t("contacts.groups.active", "Active")}</p>
          ) : null}
        </div>
        {!canManage ? <span className="contact-groups-manager-readonly"><ShieldCheck size={16} aria-hidden="true" /> {t("contacts.groups.reviewOnly", "Review only")}</span> : null}
      </header>

      {!isManual ? (
        <div className="contact-groups-manager-governance" role="note">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>{t("contacts.groups.generatedReadonly", "Generated group - read-only")}</strong>
            <p>{t("contacts.groups.generatedReason", "UOK reconciles this group from governed contact facts. Refresh its generator instead of editing its definition or membership.")}</p>
          </div>
        </div>
      ) : !canManage ? (
        <p className="contact-groups-manager-permission" role="note">{t("contacts.groups.permission", "Your role can review groups and members, but it cannot change them.")}</p>
      ) : isArchived ? (
        <p className="contact-groups-manager-permission" role="note">{t("contacts.groups.archivedHint", "Restore this manual group before editing its details or membership.")}</p>
      ) : null}

      {isManual ? (
        <form className="contact-groups-manager-form" onSubmit={(event) => { event.preventDefault(); creating ? onCreate() : onSave(); }}>
          <label className="field">
            <span>{t("contacts.groups.name", "Group name")}</span>
            <input value={name} required maxLength={120} disabled={!controlsEnabled} onChange={(event) => onNameChange(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("contacts.groups.description", "Description")}</span>
            <textarea value={description} maxLength={500} rows={3} disabled={!controlsEnabled} onChange={(event) => onDescriptionChange(event.target.value)} />
          </label>
          <div className="contact-groups-manager-form-actions">
            {creating ? <WorkspaceActionButton action="cancel" onClick={onCancelCreate} disabled={Boolean(busyAction)}>{t("command.cancel", "Cancel")}</WorkspaceActionButton> : null}
            {editable ? (
              <CommandButton icon={Save} type="submit" primary disabled={!name.trim() || !dirty || Boolean(busyAction)} loading={busyAction === (creating ? "create" : "update")}>
                {creating ? t("contacts.groups.create", "Create group") : t("command.save", "Save")}
              </CommandButton>
            ) : null}
            {!creating && isManual && group?.can_restore ? (
              <CommandButton icon={RotateCcw} data-command="restore-group" primary onClick={onRestore} disabled={Boolean(busyAction)} loading={busyAction === "restore"}>{t("contacts.groups.restore", "Restore group")}</CommandButton>
            ) : null}
          </div>
        </form>
      ) : group?.description ? <p className="contact-groups-manager-generated-description" dir="auto">{group.description}</p> : null}

      {!creating && group ? (
        <section className="contact-groups-manager-members" aria-label={t("contacts.groups.membership", "Group membership")}>
          <div className="contact-groups-manager-members-heading">
            <div>
              <h4>{t("contacts.groups.members", "Members")}</h4>
              <p>{isArchived ? t("contacts.groups.membersArchived", "Restore the group to review its active membership.") : t("contacts.groups.membersHint", "Members are contacts; removing one does not delete the contact.")}</p>
            </div>
            <span>{formatNumber(members.length)}</span>
          </div>

          {editable ? (
            <div className="contact-groups-manager-member-add">
              <label className="field">
                <span>{t("contacts.groups.findContact", "Find a contact")}</span>
                <input type="search" value={candidateQuery} disabled={!controlsEnabled} onChange={(event) => onCandidateQueryChange(event.target.value)} />
              </label>
              <label className="field">
                <span>{t("contacts.groups.contact", "Contact")}</span>
                <select value={nextPartyId} disabled={!controlsEnabled} onChange={(event) => setNextPartyId(event.target.value)}>
                  <option value="">{t("contacts.groups.chooseContact", "Choose a contact")}</option>
                  {availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.display_name}</option>)}
                </select>
              </label>
              <CommandButton icon={Plus} onClick={() => { if (nextPartyId) { onAddMember(nextPartyId); setNextPartyId(""); } }} disabled={!nextPartyId || Boolean(busyAction)} loading={busyAction === "add-member"}>
                {t("contacts.groups.addMember", "Add member")}
              </CommandButton>
            </div>
          ) : null}

          {!isArchived && members.length ? (
            <ul className="contact-groups-manager-member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <span>
                    <strong dir="auto">{member.display_name}</strong>
                    <small dir="auto">{member.organization_name || member.email || member.party_type}</small>
                  </span>
                  {editable ? (
                    <IconButton
                      icon={X}
                      label={`${t("contacts.groups.remove", "Remove")} ${member.display_name}`}
                      onClick={() => onRemoveMember(member.id)}
                      disabled={Boolean(busyAction)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : !isArchived ? <EmptyState text={t("contacts.groups.noMembers", "This group has no active members.")} /> : null}
        </section>
      ) : null}

      {!creating && group && isManual && editable && group.can_delete ? (
        <section className="contact-groups-manager-archive" aria-label={t("contacts.groups.delete", "Delete group")}>
          <ConfirmCommandButton
            key={`${group.id}:${group.status}`}
            icon={Trash2}
            message={`${t("contacts.groups.deletePrefix", "Delete")} “${group.name}” ${t("contacts.groups.deleteSuffix", "from active use?")} ${formatNumber(group.member_count)} ${t("contacts.groups.deleteImpact", "memberships will be hidden, but no contacts will be deleted. The group, memberships, saved-search references, and audit history remain, and the group can be restored from Archived.")}`}
            dialogLabel={t("contacts.groups.deleteConfirm", "Confirm group deletion")}
            title={`${t("contacts.groups.deletePrefix", "Delete")} “${group.name}”?`}
            confirmLabel={t("contacts.groups.delete", "Delete group")}
            onConfirm={onArchive}
            disabled={Boolean(busyAction)}
            loading={busyAction === "archive"}
            destructive
          >
            {t("contacts.groups.delete", "Delete group")}
          </ConfirmCommandButton>
        </section>
      ) : null}
    </section>
  );
}

function groupKindLabel(group: ManagedContactGroup | null, t: (key: string, fallback?: string) => string) {
  if (group?.kind === "business_domain") return t("contacts.groups.businessDomain", "Business domain group");
  if (group?.kind === "smart_rule") return t("contacts.groups.smartRule", "Smart-rule group");
  return t("contacts.groups.manual", "Manual");
}
