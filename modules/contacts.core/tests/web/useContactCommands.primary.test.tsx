import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommands } from "../../web/src/app/useContactCommands";
import type { ContactData } from "../../web/src/app/useContactData";
import {
  draftFromContact,
} from "../../web/src/app/contactDraft";
import { emptyDraft, type ContactRecord } from "../../web/src/contracts";
import {
  contactA,
  contactsHost,
  jsonResponse,
} from "./ContactReadTestUtils";
import { commandResponse } from "./ContactMutationTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts bounded primary commands", () => {
  it("creates with only meaningful draft fields and closes after reconciliation", async () => {
    const fetchMock = successfulCommandFetch({ contact_id: "created-contact" });
    const props = hookProps({
      creating: true,
      draft: { ...emptyDraft, display_name: " Created Contact ", email: "" },
    });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => result.current.saveDraft());

    expect(commandEnvelope(fetchMock)).toMatchObject({
      command_type: "CreateContact",
      payload: { party_type: "person", display_name: " Created Contact " },
    });
    expect(commandEnvelope(fetchMock).payload).not.toHaveProperty("email");
    expect(props.data.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
    expect(props.setCreating).toHaveBeenCalledWith(false);
    expect(props.setEditing).toHaveBeenCalledWith(false);
    expect(props.setDraft).toHaveBeenCalledWith(emptyDraft);
  });

  it("preserves intentional blank fields in a full edit payload", async () => {
    const fetchMock = successfulCommandFetch(contactA);
    const draft = {
      ...draftFromContact(contactA),
      display_name: "Contact Alpha Edited",
      email: "",
      phone: "",
    };
    const props = hookProps({ draft });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => result.current.saveDraft());

    expect(commandEnvelope(fetchMock)).toMatchObject({
      command_type: "UpdateContact",
      payload: {
        party_id: contactA.id,
        display_name: "Contact Alpha Edited",
        email: "",
        phone: "",
      },
    });
  });

  it.each([
    ["inline update", "UpdateContact", async (
      commands: ReturnType<typeof useContactCommands>,
    ) => commands.updateSelectedContactField("display_name", "Inline Name"), {
      party_id: contactA.id,
      display_name: "Inline Name",
    }],
    ["mark ready", "UpdateContact", async (
      commands: ReturnType<typeof useContactCommands>,
    ) => commands.markSelectedReady(), {
      party_id: contactA.id,
      review_state: "ready",
    }],
    ["archive", "ArchiveContact", async (
      commands: ReturnType<typeof useContactCommands>,
    ) => commands.archiveSelected(), { party_id: contactA.id }],
  ])("dispatches and reconciles %s", async (_label, commandType, invoke, payload) => {
    const fetchMock = successfulCommandFetch(contactA);
    const props = hookProps();
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => invoke(result.current));

    expect(commandEnvelope(fetchMock)).toMatchObject({
      command_type: commandType,
      payload,
    });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
    expect(props.data.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
  });

  it("uses restore capability and the selected archived Party", async () => {
    const archived = {
      ...contactA,
      status: "archived",
      can_delete: false,
      can_restore: true,
    };
    const fetchMock = successfulCommandFetch(archived);
    const props = hookProps({ data: contactData(archived) });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => result.current.restoreSelected());

    expect(commandEnvelope(fetchMock)).toMatchObject({
      command_type: "RestoreContact",
      payload: { party_id: archived.id },
    });
  });

  it("preserves the editor and draft after a reconciled command error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(
      { detail: "late gateway failure" },
      503,
    )));
    const props = hookProps({
      creating: true,
      draft: { ...emptyDraft, display_name: "Keep My Draft" },
    });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => result.current.saveDraft());

    expect(props.data.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
    expect(props.setCreating).not.toHaveBeenCalled();
    expect(props.setEditing).not.toHaveBeenCalled();
    expect(props.setDraft).not.toHaveBeenCalled();
    expect(props.data.setOut).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 503,
    }));
  });
});

function hookProps(overrides: Record<string, unknown> = {}) {
  return {
    creating: false,
    data: contactData(contactA),
    draft: draftFromContact(contactA),
    editing: true,
    host: contactsHost(),
    noteText: "",
    operational: true,
    relationshipTarget: "",
    relationshipType: "primary_contact",
    setContactDetailPane: vi.fn(),
    setCreating: vi.fn(),
    setDraft: vi.fn(),
    setEditing: vi.fn(),
    setNoteText: vi.fn(),
    setRelationshipTarget: vi.fn(),
    ...overrides,
  } as Parameters<typeof useContactCommands>[0];
}

function contactData(contact: ContactRecord): ContactData {
  return {
    contactMutationInteraction: {
      criteriaGeneration: 1,
      selectionGeneration: 1,
      selectedId: contact.id,
      selectedRevision: contact.updated_at || "",
    },
    reconcilePrimaryContacts: vi.fn().mockResolvedValue({
      kind: "applied",
      preferenceCurrent: true,
      selectedId: contact.id,
    }),
    selectedContact: contact,
    selectedContactId: contact.id,
    setOut: vi.fn(),
    supersedeReadsForMutation: vi.fn(),
  } as unknown as ContactData;
}

function successfulCommandFetch(result: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(commandResponse(result));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function commandEnvelope(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}
