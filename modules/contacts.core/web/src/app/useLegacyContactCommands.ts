import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";

import { contactCommandResultId } from "./contactCommandApi";
import {
  acquireContactCommandOperationGate,
  releaseContactCommandOperationGate,
  type ContactCommandOperationGate,
} from "./contactCommandOperationGate";
import type { ContactData } from "./useContactData";
import type { ContactMergeFieldChoices, ContactCommandResponse } from "../contracts";

export function useLegacyContactCommands({
  data,
  host,
  operationGate,
}: {
  data: ContactData;
  host: ModuleSurfaceRenderContext;
  operationGate: ContactCommandOperationGate;
}) {
  async function command(
    commandType: string,
    payload: Record<string, unknown>,
    prefix: string,
  ) {
    try {
      data.setBusyAction(commandType);
      const response = await data.api<ContactCommandResponse>("/api/commands", {
        method: "POST",
        body: JSON.stringify({
          command_type: commandType,
          payload,
          idempotency_key: `${prefix}:${Date.now()}`,
        }),
      });
      data.setOut(response);
      await Promise.all([data.refresh(), host.refreshHost()]);
      return response;
    } catch (error) {
      data.setOut(error);
      return null;
    } finally {
      data.setBusyAction("");
    }
  }

  async function purgeSelected() {
    if (!data.selectedContactId) throw new Error("No contact selected.");
    const completed = await runLegacyOperation(async () => Boolean(await command(
      "PurgeContact",
      { party_id: data.selectedContactId },
      "contact-purge",
    )));
    if (!completed) {
      throw new Error("The contact could not be purged. Review the latest record and try again.");
    }
  }

  async function addSelectedContactToGroup(groupId: string) {
    if (!data.selectedContactId || !groupId) return false;
    return runLegacyOperation(async () => {
      const result = await command("AddContactsToGroup", {
        group_id: groupId,
        party_ids: [data.selectedContactId],
      }, "contact-group-add");
      if (!result) return false;
      await data.loadContactDetail(data.selectedContactId);
      return true;
    });
  }

  async function removeSelectedContactFromGroup(groupId: string) {
    if (!data.selectedContactId || !groupId) return false;
    return runLegacyOperation(async () => {
      const result = await command("RemoveContactFromGroup", {
        group_id: groupId,
        party_id: data.selectedContactId,
      }, "contact-group-remove");
      if (!result) return false;
      await data.loadContactDetail(data.selectedContactId);
      return true;
    });
  }

  async function mergeDuplicate(
    primaryContactId: string,
    duplicateContactId: string,
    fieldChoices: ContactMergeFieldChoices = {},
  ) {
    if (!primaryContactId || !duplicateContactId) return false;
    return runLegacyOperation(async () => {
      const choices = Object.keys(fieldChoices).length
        ? { field_choices: fieldChoices }
        : {};
      const result = await command("MergeDuplicateContact", {
        primary_party_id: primaryContactId,
        duplicate_party_id: duplicateContactId,
        ...choices,
      }, "contact-duplicate-merge");
      if (!result) return false;
      const resultId = contactCommandResultId(result.result) || primaryContactId;
      data.setSelectedContactId(resultId);
      await data.loadContactDetail(resultId);
      return true;
    });
  }

  async function runLegacyOperation(
    operation: () => Promise<boolean>,
  ) {
    const owner = acquireContactCommandOperationGate(operationGate);
    if (!owner) return false;
    try {
      return await operation();
    } finally {
      releaseContactCommandOperationGate(operationGate, owner);
    }
  }

  return {
    addSelectedContactToGroup,
    mergeDuplicate,
    purgeSelected,
    removeSelectedContactFromGroup,
  };
}
