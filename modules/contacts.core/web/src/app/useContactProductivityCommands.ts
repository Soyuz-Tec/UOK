import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { ContactRecord } from "../contracts";
import type { ContactRelationshipEditorIntent } from "../types";
import type { ContactManagedRunner } from "./contactCommandCoordinatorTypes";
import type { ContactData } from "./useContactData";

export function useContactProductivityCommands({
  data,
  noteText,
  relationshipTarget,
  relationshipType,
  runManaged,
  setNoteText,
  setRelationshipTarget,
}: {
  data: ContactData;
  noteText: string;
  relationshipTarget: string;
  relationshipType: string;
  runManaged: ContactManagedRunner;
  setNoteText: Dispatch<SetStateAction<string>>;
  setRelationshipTarget: Dispatch<SetStateAction<string>>;
}) {
  const currentRef = useRef({
    data,
    relationshipTarget,
    relationshipType,
  });
  const noteIntentRef = useRef({ value: noteText, generation: 0 });
  if (noteIntentRef.current.value !== noteText) {
    noteIntentRef.current = {
      value: noteText,
      generation: noteIntentRef.current.generation + 1,
    };
  }
  const composerKey = JSON.stringify([relationshipTarget, relationshipType]);
  const relationshipComposerRef = useRef({ key: composerKey, generation: 0 });
  if (relationshipComposerRef.current.key !== composerKey) {
    relationshipComposerRef.current = {
      key: composerKey,
      generation: relationshipComposerRef.current.generation + 1,
    };
  }
  currentRef.current = { data, relationshipTarget, relationshipType };
  const [refreshGeneration, setRefreshGeneration] = useState(0);

  async function addNote() {
    const target = selectedTarget();
    const intentGeneration = noteIntentRef.current.generation;
    const body = noteText;
    if (!target.id || !body.trim()) return false;
    return runManaged({
      action: "AddContactNote",
      payload: { party_id: target.id, body },
      intentIsCurrent: () => targetCurrent(target)
        && noteIntentRef.current.generation === intentGeneration,
      preferredId: () => target.id,
      onSuccess: () => {
        setNoteText("");
        advanceRefresh();
      },
    });
  }

  async function linkRelationship() {
    const target = selectedTarget();
    const intentGeneration = relationshipComposerRef.current.generation;
    const toPartyId = relationshipTarget;
    const nextType = relationshipType;
    if (!target.id || !toPartyId || target.id === toPartyId) return false;
    return runManaged({
      action: "LinkContactRelationship",
      payload: {
        from_party_id: target.id,
        to_party_id: toPartyId,
        relationship_type: nextType,
      },
      intentIsCurrent: () => targetCurrent(target)
        && relationshipComposerRef.current.generation === intentGeneration
        && currentRef.current.relationshipTarget === toPartyId
        && currentRef.current.relationshipType === nextType,
      preferredId: () => target.id,
      onSuccess: () => {
        setRelationshipTarget("");
        advanceRefresh();
      },
    });
  }

  async function updateRelationship(
    relationshipId: string,
    fromPartyId: string,
    toPartyId: string,
    nextType: string,
    editorIntent: ContactRelationshipEditorIntent,
  ) {
    const target = selectedTarget();
    const relationship = selectedRelationship(relationshipId);
    const intentGeneration = editorIntent.generation;
    if (!target.id || !relationship || !fromPartyId || !toPartyId
      || fromPartyId === toPartyId
      || (fromPartyId !== target.id && toPartyId !== target.id)) return false;
    return runManaged({
      action: "UpdateContactRelationship",
      payload: {
        relationship_id: relationshipId,
        from_party_id: fromPartyId,
        to_party_id: toPartyId,
        relationship_type: nextType,
      },
      intentIsCurrent: () => targetCurrent(target)
        && relationshipCurrent(relationship)
        && editorIntent.isCurrent(intentGeneration),
      preferredId: () => target.id,
      onSuccess: advanceRefresh,
    });
  }

  async function removeRelationship(relationshipId: string) {
    const target = selectedTarget();
    const relationship = selectedRelationship(relationshipId);
    if (!target.id || !relationship) return false;
    return runManaged({
      action: "RemoveContactRelationship",
      payload: { relationship_id: relationshipId },
      intentIsCurrent: () => targetCurrent(target) && relationshipCurrent(relationship),
      preferredId: () => target.id,
      onSuccess: advanceRefresh,
    });
  }

  function advanceRefresh() {
    setRefreshGeneration((current) => current + 1);
  }

  function selectedTarget() {
    return {
      id: data.selectedContactId,
      revision: data.contactMutationInteraction.selectedRevision,
    };
  }

  function targetCurrent(target: ReturnType<typeof selectedTarget>) {
    const current = currentRef.current.data;
    return current.selectedContactId === target.id
      && current.contactMutationInteraction.selectedRevision === target.revision;
  }

  function selectedRelationship(relationshipId: string) {
    const relationship = data.selectedContact?.relationships?.find(
      (row) => row.id === relationshipId,
    );
    return relationship ? {
      id: relationship.id,
      fingerprint: relationshipFingerprint(relationship),
    } : null;
  }

  function relationshipCurrent(
    captured: NonNullable<ReturnType<typeof selectedRelationship>>,
  ) {
    const relationship = currentRef.current.data.selectedContact?.relationships?.find(
      (row) => row.id === captured.id,
    );
    return Boolean(relationship
      && relationshipFingerprint(relationship) === captured.fingerprint);
  }

  return {
    addNote,
    linkRelationship,
    productivityRefreshGeneration: refreshGeneration,
    removeRelationship,
    updateRelationship,
  };
}

type ContactRelationship = NonNullable<ContactRecord["relationships"]>[number];

function relationshipFingerprint(relationship: ContactRelationship) {
  return JSON.stringify([
    relationship.id,
    relationship.from_party_id,
    relationship.to_party_id,
    relationship.relationship_type,
    relationship.direction || "",
    relationship.related_party_id || "",
  ]);
}
