import { vi } from "vitest";

import { draftFromContact } from "../../web/src/app/contactDraft";
import type { useContactCommands } from "../../web/src/app/useContactCommands";
import type { ContactData } from "../../web/src/app/useContactData";
import type { ContactRecord } from "../../web/src/contracts";
import type { ContactRelationshipEditorIntent } from "../../web/src/types";
import { contactA, contactB, contactsHost } from "./ContactReadTestUtils";

export type Commands = ReturnType<typeof useContactCommands>;
export type HookProps = Parameters<typeof useContactCommands>[0];

export const contactWithRelationship: ContactRecord = {
  ...contactA,
  relationships: [{
    id: "relationship-a",
    from_party_id: contactA.id,
    to_party_id: contactB.id,
    relationship_type: "works_for",
    direction: "outbound",
    related_party_id: contactB.id,
  }],
};

export function productivityHookProps(
  overrides: Partial<HookProps> = {},
): HookProps {
  return {
    creating: false,
    data: productivityContactData(contactA),
    draft: draftFromContact(contactA),
    editing: false,
    host: contactsHost(),
    noteText: "Private productivity note",
    operational: true,
    relationshipTarget: contactB.id,
    relationshipType: "works_for",
    setContactDetailPane: vi.fn(),
    setCreating: vi.fn(),
    setDraft: vi.fn(),
    setEditing: vi.fn(),
    setNoteText: vi.fn(),
    setRelationshipTarget: vi.fn(),
    ...overrides,
  };
}

export function productivityContactData(
  contact: ContactRecord,
  reconcilePrimaryContacts = vi.fn().mockResolvedValue({
    kind: "applied",
    preferenceCurrent: true,
    selectedId: contact.id,
  }),
  selectionGeneration = 1,
): ContactData {
  return {
    api: vi.fn(),
    contactMutationInteraction: {
      criteriaGeneration: 1,
      selectionGeneration,
      selectedId: contact.id,
      selectedRevision: contact.updated_at || "",
    },
    loadContactDetail: vi.fn().mockResolvedValue(undefined),
    reconcilePrimaryContacts,
    refresh: vi.fn().mockResolvedValue(undefined),
    selectedContact: contact,
    selectedContactId: contact.id,
    setBusyAction: vi.fn(),
    setOut: vi.fn(),
    setSelectedContactId: vi.fn(),
    supersedeReadsForMutation: vi.fn(),
  } as unknown as ContactData;
}

export function currentEditorIntent(): ContactRelationshipEditorIntent {
  return { generation: 1, isCurrent: (generation) => generation === 1 };
}

export function commandEnvelope(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}
