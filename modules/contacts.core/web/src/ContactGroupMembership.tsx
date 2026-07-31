import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { EmptyState, RecordTagList } from "@uok/shared/data-display";
import { IconButton } from "@uok/shared/primitives";
import type { ContactGroupRecord, ContactRecord } from "./contracts";

const systemGroupPrefixes = ["Company:", "Country:", "Review:", "Source:", "Type:"];

function isSystemGroup(group: { kind?: string; name: string }) {
  if (group.kind) return group.kind !== "manual";
  return systemGroupPrefixes.some((prefix) => group.name.startsWith(prefix));
}

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
  const memberships = useMemo(() => contact.groups || [], [contact.groups]);
  const memberGroupIds = useMemo(() => new Set(memberships.map((group) => group.id)), [memberships]);
  const availableGroups = groups.filter((group) => group.kind === "manual" && group.status === "active" && !memberGroupIds.has(group.id));
  const userGroups = memberships.filter((group) => !isSystemGroup(group));
  const systemGroups = memberships.filter((group) => isSystemGroup(group));

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
        <div className="contact-group-membership-content">
          <RecordTagList
            items={userGroups.map((group) => ({
              id: group.id,
              label: group.name,
              removeLabel: `Remove ${contact.display_name} from ${group.name}`
            }))}
            onRemove={(groupId) => void onRemoveFromGroup(groupId)}
            removeIcon={X}
            emptyText={systemGroups.length ? undefined : "No user-managed groups."}
          />
          {systemGroups.length ? (
            <div className="contact-system-labels">
              <p>System labels</p>
              <RecordTagList
                items={systemGroups.map((group) => ({
                  id: group.id,
                  label: group.name,
                  tone: "system"
                }))}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState text="No group memberships." />
      )}
    </section>
  );
}
