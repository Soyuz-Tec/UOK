import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { EmptyState } from "../../shared/data-display";
import { IconButton } from "../../shared/primitives";
import type { ContactGroupRecord, ContactRecord } from "../../shared/types";

export function ContactGroupMembership({
  contact,
  groups,
  onAddToGroup,
  onRemoveFromGroup
}: {
  contact: ContactRecord;
  groups: ContactGroupRecord[];
  onAddToGroup: (groupId: string) => Promise<void>;
  onRemoveFromGroup: (groupId: string) => Promise<void>;
}) {
  const [nextGroupId, setNextGroupId] = useState("");
  const memberships = contact.groups || [];
  const memberGroupIds = useMemo(() => new Set(memberships.map((group) => group.id)), [memberships]);
  const availableGroups = groups.filter((group) => !memberGroupIds.has(group.id));

  async function addMembership() {
    if (!nextGroupId) return;
    await onAddToGroup(nextGroupId);
    setNextGroupId("");
  }

  return (
    <section className="contact-group-membership" aria-label="Contact group memberships">
      <div className="contact-group-membership-header">
        <p className="eyebrow">Groups</p>
        <div className="contact-group-membership-add">
          <label className="field compact">
            <span className="visually-hidden">Add to group</span>
            <select value={nextGroupId} onChange={(event) => setNextGroupId(event.target.value)}>
              <option value="">Add to group</option>
              {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <IconButton icon={Plus} label="Add contact to selected group" onClick={() => void addMembership()} disabled={!nextGroupId} />
        </div>
      </div>
      {memberships.length ? (
        <div className="contact-group-membership-list">
          {memberships.map((group) => (
            <div className="contact-group-membership-row" key={group.member_id || group.id}>
              <span>{group.name}</span>
              <IconButton
                icon={X}
                label={`Remove ${contact.display_name} from ${group.name}`}
                title={`Remove from ${group.name}`}
                onClick={() => void onRemoveFromGroup(group.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No group memberships." />
      )}
    </section>
  );
}
