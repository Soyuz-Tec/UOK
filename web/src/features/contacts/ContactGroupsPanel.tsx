import { Archive, AtSign, Layers3, Plus, UsersRound } from "lucide-react";

import { SectionHeading } from "../../shared/layout";
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
  onGroupContactsBySmartRules,
  onArchiveGroup,
  domainGroupingBusy = false,
  smartGroupingBusy = false
}: {
  groups: ContactGroupRecord[];
  selectedGroupId: string;
  newGroupName: string;
  onGroupChange: (value: string) => void;
  onNewGroupNameChange: (value: string) => void;
  onCreateGroup: () => void;
  onGroupContactsByBusinessDomain: () => void;
  onGroupContactsBySmartRules: () => void;
  onArchiveGroup: (groupId: string) => void;
  domainGroupingBusy?: boolean;
  smartGroupingBusy?: boolean;
}) {
  return (
    <aside className="contacts-group-sidebar uok-row-rhythm" aria-label="Contact groups">
      <SectionHeading
        title="Contact groups"
        action={<UsersRound size={18} aria-hidden="true" />}
      />
      <div className="contact-group-list uok-row-list" role="list">
        <button
          type="button"
          className={selectedGroupId ? "contact-group-button uok-row" : "contact-group-button uok-row selected"}
          aria-pressed={!selectedGroupId}
          onClick={() => onGroupChange("")}
        >
          <span>All contacts</span>
        </button>
        {groups.map((group) => (
          <div className="contact-group-row uok-row" role="listitem" key={group.id}>
            <button
              type="button"
              className={selectedGroupId === group.id ? "contact-group-button selected" : "contact-group-button"}
              aria-pressed={selectedGroupId === group.id}
              onClick={() => onGroupChange(group.id)}
            >
              <span title={group.name}>{group.name}</span>
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
          <span className="visually-hidden">Group name</span>
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
        <CommandButton icon={Layers3} onClick={onGroupContactsBySmartRules} loading={smartGroupingBusy}>
          Smart groups
        </CommandButton>
      </div>
    </aside>
  );
}
