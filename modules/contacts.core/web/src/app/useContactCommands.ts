import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";

import { nonEmptyDraftPayload } from "./contactDraft";
import { contactCommandResultId, executeContactCommand } from "./contactCommandApi";
import type { ContactData } from "./useContactData";
import { useContactCommandCoordinator } from "./useContactCommandCoordinator";
import { useLegacyContactCommands } from "./useLegacyContactCommands";
import { useContactProductivityCommands } from "./useContactProductivityCommands";
import { createContactCommandOperationGate } from "./contactCommandOperationGate";
import type { ContactManagedCommand } from "./contactCommandCoordinatorTypes";
import type {
  ContactDetailPane,
  ContactDraft,
  ContactCommandResponse,
} from "../contracts";
import { emptyDraft } from "../contracts";

export function useContactCommands({
  creating,
  data,
  draft,
  editing,
  host,
  noteText,
  operational,
  relationshipTarget,
  relationshipType,
  setContactDetailPane,
  setCreating,
  setDraft,
  setEditing,
  setNoteText,
  setRelationshipTarget,
}: {
  creating: boolean;
  data: ContactData;
  draft: ContactDraft;
  editing: boolean;
  host: ModuleSurfaceRenderContext;
  noteText: string;
  operational: boolean;
  relationshipTarget: string;
  relationshipType: string;
  setContactDetailPane: Dispatch<SetStateAction<ContactDetailPane>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setDraft: Dispatch<SetStateAction<ContactDraft>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setNoteText: Dispatch<SetStateAction<string>>;
  setRelationshipTarget: Dispatch<SetStateAction<string>>;
}) {
  const currentRef = useRef({ creating, data, draft, editing });
  const editorRef = useRef({ key: "", generation: 0 });
  const editorKey = JSON.stringify([creating, editing, draft]);
  if (editorRef.current.key !== editorKey) {
    editorRef.current = {
      key: editorKey,
      generation: editorRef.current.generation + 1,
    };
  }
  currentRef.current = { creating, data, draft, editing };
  const [operationGate] = useState(createContactCommandOperationGate);
  const coordinator = useContactCommandCoordinator({
    host,
    operational,
    interaction: data.contactMutationInteraction,
    operationGate,
    reconcilePrimaryContacts: data.reconcilePrimaryContacts,
    supersedeReadsForMutation: data.supersedeReadsForMutation,
  });
  const legacy = useLegacyContactCommands({
    data,
    host,
    operationGate,
  });
  const productivity = useContactProductivityCommands({
    data,
    noteText,
    relationshipTarget,
    relationshipType,
    runManaged,
    setNoteText,
    setRelationshipTarget,
  });

  async function saveDraft() {
    const intentGeneration = editorRef.current.generation;
    if (creating) {
      return runManaged({
        action: "CreateContact",
        payload: nonEmptyDraftPayload(draft),
        intentIsCurrent: () => editorIntentCurrent(intentGeneration, true),
        preferredId: (response) => contactCommandResultId(response?.result),
        onSuccess: closeEditorAfterSave,
      });
    }
    const target = selectedTarget();
    if (!editing || !target.id) return false;
    return runManaged({
      action: "UpdateContact",
      payload: { ...draft, party_id: target.id },
      intentIsCurrent: () => editorIntentCurrent(intentGeneration, false)
        && targetCurrent(target),
      preferredId: () => target.id,
      onSuccess: closeEditorAfterSave,
    });
  }

  async function updateSelectedContactField(field: keyof ContactDraft, value: string) {
    const target = selectedTarget();
    if (!target.id) throw new Error("No contact selected.");
    const success = await runManaged({
      action: "UpdateContact",
      payload: { party_id: target.id, [field]: value },
      intentIsCurrent: () => targetCurrent(target),
      preferredId: () => target.id,
    });
    if (!success) throw new Error("Contact update failed.");
  }

  async function archiveSelected() {
    const target = selectedTarget();
    if (!target.id || !target.canDelete) throw new Error("No deletable contact selected.");
    const success = await runManaged({
      action: "ArchiveContact",
      payload: { party_id: target.id },
      intentIsCurrent: () => targetCurrent(target, "delete"),
      preferredId: () => target.id,
    });
    if (!success) throw new Error("The contact could not be deleted. Review the latest record and try again.");
  }

  async function restoreSelected() {
    const target = selectedTarget();
    if (!target.id || !target.canRestore) return false;
    return runManaged({
      action: "RestoreContact",
      capability: "restore",
      payload: { party_id: target.id },
      intentIsCurrent: () => targetCurrent(target, "restore"),
      preferredId: () => target.id,
    });
  }

  async function markSelectedReady() {
    const target = selectedTarget();
    if (!target.id) return false;
    return runManaged({
      action: "UpdateContact",
      payload: { party_id: target.id, review_state: "ready" },
      intentIsCurrent: () => targetCurrent(target),
      preferredId: () => target.id,
    });
  }

  async function runManaged({
    action,
    capability = "manage",
    payload,
    intentIsCurrent,
    preferredId,
    onSuccess = () => undefined,
  }: {
    action: ContactManagedCommand;
    capability?: "manage" | "restore";
    payload: Record<string, unknown>;
    intentIsCurrent: () => boolean;
    preferredId: (response?: ContactCommandResponse) => string | undefined;
    onSuccess?: () => void;
  }) {
    let dispatchPayload: Record<string, unknown> | null = payload;
    return coordinator.runOperation({
      action,
      capability,
      execute: (request) => {
        const nextPayload = dispatchPayload;
        dispatchPayload = null;
        return nextPayload
          ? executeContactCommand(request.token, action, nextPayload, request)
          : Promise.reject(new Error("The Contacts command dispatch was already consumed."));
      },
      intentIsCurrent,
      preferredSelectedId: preferredId,
      onAccepted: () => currentRef.current.data.setOut(null),
      onSuccess: () => {
        currentRef.current.data.setOut(null);
        onSuccess();
      },
      onError: (error) => currentRef.current.data.setOut(error),
      onPending: (error) => currentRef.current.data.setOut(
        error || "Contacts reconciliation is pending. Refresh to retry.",
      ),
    });
  }

  function closeEditorAfterSave() {
    setContactDetailPane("overview");
    setCreating(false);
    setEditing(false);
    setDraft(emptyDraft);
  }

  function editorIntentCurrent(generation: number, expectedCreating: boolean) {
    return editorRef.current.generation === generation
      && currentRef.current.creating === expectedCreating
      && currentRef.current.editing;
  }

  function selectedTarget() {
    const contact = data.selectedContact;
    return {
      id: data.selectedContactId,
      revision: data.contactMutationInteraction.selectedRevision,
      canDelete: contact?.can_delete === true,
      canRestore: contact?.can_restore === true,
    };
  }

  function targetCurrent(
    target: ReturnType<typeof selectedTarget>,
    required?: "delete" | "restore",
  ) {
    const current = currentRef.current.data;
    const contact = current.selectedContact;
    return current.selectedContactId === target.id
      && current.contactMutationInteraction.selectedRevision === target.revision
      && (!required || (required === "delete"
        ? contact?.can_delete === true
        : contact?.can_restore === true));
  }

  return {
    ...legacy,
    ...productivity,
    archiveSelected,
    busyAction: coordinator.busyAction,
    markSelectedReady,
    reconciliationPending: coordinator.reconciliationPending,
    restoreSelected,
    retryPendingReconciliation: coordinator.retryPendingReconciliation,
    saveDraft,
    updateSelectedContactField,
  };
}
