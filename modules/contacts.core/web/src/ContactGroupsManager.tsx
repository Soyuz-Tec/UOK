import { useState } from "react";
import { Plus } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { ContactGroupsManagerDetail } from "./ContactGroupsManagerDetail";
import {
  ContactGroupsManagerList,
  type ContactGroupKindFilter,
  type ContactGroupStatusFilter
} from "./ContactGroupsManagerList";
import { useContactGroupsManager, type ContactGroupManagerNotice } from "./useContactGroupsManager";

export function ContactGroupsManager({
  open,
  token,
  canManage,
  onClose,
  onChanged,
  onGroupArchived
}: {
  open: boolean;
  token: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onGroupArchived: (groupId: string) => void;
}) {
  const { t } = useUokLocalization();
  const manager = useContactGroupsManager({ token, open, canManage, onChanged, onGroupArchived });
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<ContactGroupKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ContactGroupStatusFilter>("active");
  const [emptyOnly, setEmptyOnly] = useState(false);
  const busy = Boolean(manager.busyAction);

  return (
    <WorkspaceEditorPopup
      open={open}
      label={t("contacts.groups.manager", "Groups manager")}
      title={t("contacts.groups.manager", "Groups manager")}
      description={t("contacts.groups.managerDescription", "Create and review manual groups; inspect generated working sets without changing governed definitions.")}
      onClose={onClose}
      dismissible={!busy}
      size="wide"
      className="contact-groups-manager-popup"
    >
      {manager.error ? <p className="contact-groups-manager-error" role="alert">{manager.error}</p> : null}
      <p className="visually-hidden" aria-live="polite">{manager.notice ? noticeText(manager.notice, t) : ""}</p>
      {manager.loading ? (
        <div className="contact-groups-manager-loading" role="status">{t("contacts.groups.loading", "Loading contact groups...")}</div>
      ) : manager.groups.length || manager.creating ? (
        <div className="contact-groups-manager-layout" aria-busy={busy || undefined}>
          <ContactGroupsManagerList
            groups={manager.groups}
            selectedGroupId={manager.selectedGroupId}
            search={search}
            kindFilter={kindFilter}
            statusFilter={statusFilter}
            emptyOnly={emptyOnly}
            canManage={canManage}
            busyAction={manager.busyAction}
            onSearchChange={setSearch}
            onKindFilterChange={setKindFilter}
            onStatusFilterChange={setStatusFilter}
            onEmptyOnlyChange={setEmptyOnly}
            onSelect={manager.setSelectedGroupId}
            onStartCreate={manager.startCreate}
            onGenerateBusinessDomains={manager.generateBusinessDomains}
            onGenerateSmartGroups={manager.generateSmartGroups}
          />
          <ContactGroupsManagerDetail
            group={manager.selectedGroup}
            creating={manager.creating}
            name={manager.name}
            description={manager.description}
            members={manager.members}
            candidates={manager.candidates}
            candidateQuery={manager.candidateQuery}
            canManage={canManage}
            busyAction={manager.busyAction}
            onNameChange={manager.setName}
            onDescriptionChange={manager.setDescription}
            onCandidateQueryChange={manager.setCandidateQuery}
            onCreate={manager.createGroup}
            onCancelCreate={manager.cancelCreate}
            onSave={manager.updateGroup}
            onArchive={manager.archiveGroup}
            onRestore={manager.restoreGroup}
            onAddMember={manager.addMember}
            onRemoveMember={manager.removeMember}
          />
        </div>
      ) : (
        <div className="contact-groups-manager-empty">
          <EmptyState text={t("contacts.groups.none", "No contact groups are available.")} />
          {canManage ? <CommandButton icon={Plus} primary onClick={manager.startCreate}>{t("contacts.groups.createFirst", "Create the first group")}</CommandButton> : null}
        </div>
      )}
    </WorkspaceEditorPopup>
  );
}

function noticeText(notice: ContactGroupManagerNotice, t: (key: string, fallback?: string) => string) {
  const messages: Record<ContactGroupManagerNotice, string> = {
    created: t("contacts.groups.noticeCreated", "Group created."),
    updated: t("contacts.groups.noticeUpdated", "Group updated."),
    archived: t("contacts.groups.noticeArchived", "Group archived."),
    restored: t("contacts.groups.noticeRestored", "Group restored."),
    memberAdded: t("contacts.groups.noticeMemberAdded", "Member added."),
    memberRemoved: t("contacts.groups.noticeMemberRemoved", "Member removed."),
    generated: t("contacts.groups.noticeGenerated", "Generated groups reconciled.")
  };
  return messages[notice];
}
