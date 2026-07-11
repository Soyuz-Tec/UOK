import type { Dispatch, SetStateAction } from "react";

import { nonEmptyDraftPayload } from "./contactDraft";
import type { WorkbenchActions } from "@uok/app/useWorkbenchActions";
import type { WorkbenchData } from "@uok/app/useWorkbenchData";
import type { ContactDetailPane, ContactDraft, ContactMergeFieldChoices } from "@uok/shared/types";
import { emptyDraft } from "@uok/shared/types";

export function useContactCommands({
  command,
  creating,
  data,
  draft,
  noteText,
  newGroupName,
  relationshipTarget,
  relationshipType,
  setContactDetailPane,
  setCreating,
  setDraft,
  setEditing,
  setNoteText,
  setNewGroupName,
  setRelationshipTarget
}: {
  command: WorkbenchActions["command"];
  creating: boolean;
  data: WorkbenchData;
  draft: ContactDraft;
  noteText: string;
  newGroupName: string;
  relationshipTarget: string;
  relationshipType: string;
  setContactDetailPane: Dispatch<SetStateAction<ContactDetailPane>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setDraft: Dispatch<SetStateAction<ContactDraft>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setNoteText: Dispatch<SetStateAction<string>>;
  setNewGroupName: Dispatch<SetStateAction<string>>;
  setRelationshipTarget: Dispatch<SetStateAction<string>>;
}) {
  async function saveDraft() {
    const payload = nonEmptyDraftPayload(draft);
    const result = !creating && data.selectedContactId
      ? await command("UpdateContact", { ...payload, party_id: data.selectedContactId }, "contact-update")
      : await command("CreateContact", payload, "contact-create");
    const resultId = result?.result?.id || result?.result?.contact_id;
    if (resultId) data.setSelectedContactId(resultId);
    setContactDetailPane("overview");
    setCreating(false);
    setEditing(false);
    setDraft(emptyDraft);
  }

  async function updateSelectedContactField(field: keyof ContactDraft, value: string) {
    if (!data.selectedContactId) throw new Error("No contact selected.");
    const result = await command("UpdateContact", { party_id: data.selectedContactId, [field]: value }, `contact-inline-${field}`);
    if (!result) throw new Error("Contact update failed.");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function archiveSelected() {
    if (data.selectedContactId) await command("ArchiveContact", { party_id: data.selectedContactId }, "contact-archive");
  }

  async function restoreSelected() {
    if (data.selectedContactId) await command("RestoreContact", { party_id: data.selectedContactId }, "contact-restore");
  }

  async function purgeSelected() {
    if (data.selectedContactId) await command("PurgeContact", { party_id: data.selectedContactId }, "contact-purge");
  }

  async function markSelectedReady() {
    if (data.selectedContactId) {
      await command("UpdateContact", { party_id: data.selectedContactId, review_state: "ready" }, "contact-mark-ready");
      await data.loadContactDetail(data.selectedContactId);
    }
  }

  async function addNote() {
    if (!data.selectedContactId || !noteText.trim()) return;
    await command("AddContactNote", { party_id: data.selectedContactId, body: noteText }, "contact-note");
    setNoteText("");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    await command("CreateContactGroup", { name }, "contact-group-create");
    setNewGroupName("");
  }

  async function archiveGroup(groupId: string) {
    if (!groupId) return;
    await command("ArchiveContactGroup", { group_id: groupId }, "contact-group-archive");
  }

  async function groupContactsByBusinessDomain() {
    await command("GroupContactsByBusinessEmailDomain", { minimum_members: 2 }, "contact-group-domain");
  }

  async function groupContactsBySmartRules() {
    for (const rule of ["organization", "country", "party_type", "review_state", "source"]) {
      await command("GroupContactsBySmartRule", { rule, minimum_members: 2 }, "contact-group-smart");
    }
  }

  async function addSelectedContactToGroup(groupId: string) {
    if (!data.selectedContactId || !groupId) return;
    await command("AddContactsToGroup", { group_id: groupId, party_ids: [data.selectedContactId] }, "contact-group-add");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function removeSelectedContactFromGroup(groupId: string) {
    if (!data.selectedContactId || !groupId) return;
    await command("RemoveContactFromGroup", { group_id: groupId, party_id: data.selectedContactId }, "contact-group-remove");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function linkRelationship() {
    if (!data.selectedContactId || !relationshipTarget) return;
    await command("LinkContactRelationship", {
      from_party_id: data.selectedContactId,
      to_party_id: relationshipTarget,
      relationship_type: relationshipType
    }, "contact-relationship");
    setRelationshipTarget("");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function updateRelationship(relationshipId: string, fromPartyId: string, toPartyId: string, nextRelationshipType: string) {
    if (!data.selectedContactId || !relationshipId || !fromPartyId || !toPartyId) return;
    await command("UpdateContactRelationship", {
      relationship_id: relationshipId,
      from_party_id: fromPartyId,
      to_party_id: toPartyId,
      relationship_type: nextRelationshipType
    }, "contact-relationship-update");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function removeRelationship(relationshipId: string) {
    if (!data.selectedContactId || !relationshipId) return;
    await command("RemoveContactRelationship", { relationship_id: relationshipId }, "contact-relationship-remove");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function mergeDuplicate(primaryContactId: string, duplicateContactId: string, fieldChoices: ContactMergeFieldChoices = {}) {
    if (!primaryContactId || !duplicateContactId) return;
    const choices = Object.keys(fieldChoices).length ? { field_choices: fieldChoices } : {};
    const result = await command("MergeDuplicateContact", {
      primary_party_id: primaryContactId,
      duplicate_party_id: duplicateContactId,
      ...choices
    }, "contact-duplicate-merge");
    const resultId = result?.result?.id || result?.result?.contact_id || primaryContactId;
    data.setSelectedContactId(resultId);
    await data.loadContactDetail(resultId);
  }

  return {
    addNote,
    addSelectedContactToGroup,
    archiveSelected,
    archiveGroup,
    createGroup,
    groupContactsByBusinessDomain,
    groupContactsBySmartRules,
    linkRelationship,
    markSelectedReady,
    mergeDuplicate,
    purgeSelected,
    removeRelationship,
    removeSelectedContactFromGroup,
    restoreSelected,
    saveDraft,
    updateRelationship,
    updateSelectedContactField
  };
}
