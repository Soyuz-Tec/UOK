import { Archive, AtSign, Plus, UsersRound } from "lucide-react";

import { CommandButton, IconButton } from "../../shared/primitives";
import type { ContactGroupRecord } from "../../shared/types";

export function ContactGroupsPanel({
  groups,
  selectedGroupId,
  newGroupName,
  onGroupChange,
  onNewGroupNameChange,
  onCreateGroup,
  onGroupContactsByBusinessDomain,
  onArchiveGroup,
  domainGroupingBusy = false
}: {
  groups: ContactGroupRecord[];
  selectedGroupId: string;
  newGroupName: string;
  onGroupChange: (value: string) => void;
  onNewGroupNameChange: (value: string) => void;
  onCreateGroup: () => void;
  onGroupContactsByBusinessDomain: () => void;
  onArchiveGroup: (groupId: string) => void;
  domainGroupingBusy?: boolean;
}) {
  return (
    <aside className="contacts-group-sidebar" aria-label="Contact groups">
      <div className="contacts-group-sidebar-header">
        <div>
          <p className="eyebrow">Groups</p>
          <h3>Contact groups</h3>
        </div>
        <UsersRound size={18} aria-hidden="true" />
      </div>
      <div className="contact-group-list" role="list">
        <button
          type="button"
          className={selectedGroupId ? "contact-group-button" : "contact-group-button selected"}
          aria-pressed={!selectedGroupId}
          onClick={() => onGroupChange("")}
        >
          <span>All contacts</span>
        </button>
        {groups.map((group) => (
          <div className="contact-group-row" role="listitem" key={group.id}>
            <button
              type="button"
              className={selectedGroupId === group.id ? "contact-group-button selected" : "contact-group-button"}
              aria-pressed={selectedGroupId === group.id}
              onClick={() => onGroupChange(group.id)}
            >
              <span>{group.name}</span>
              <small title={`${group.member_count} total members`}>{group.active_member_count ?? group.member_count}</small>
            </button>
            <IconButton icon={Archive} label={`Archive ${group.name}`} title={`Archive ${group.name}`} onClick={() => onArchiveGroup(group.id)} />
          </div>
        ))}
      </div>
      <form
        className="contact-group-create"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateGroup();
        }}
      >
        <label className="field">
          <span>New group</span>
          <input
            value={newGroupName}
            maxLength={120}
            placeholder="Group name"
            onChange={(event) => onNewGroupNameChange(event.target.value)}
          />
        </label>
        <IconButton icon={Plus} label="Create contact group" type="submit" primary disabled={!newGroupName.trim()} />
      </form>
      <div className="contact-group-domain-action">
        <CommandButton icon={AtSign} onClick={onGroupContactsByBusinessDomain} loading={domainGroupingBusy}>
          Business domains
        </CommandButton>
      </div>
    </aside>
  );
}
