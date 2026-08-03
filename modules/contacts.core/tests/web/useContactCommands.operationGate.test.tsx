import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { draftFromContact } from "../../web/src/app/contactDraft";
import { useContactCommands } from "../../web/src/app/useContactCommands";
import type { ContactData } from "../../web/src/app/useContactData";
import type { ContactRecord } from "../../web/src/contracts";
import { succeededResponse } from "./ContactCommandCoordinatorTestUtils";
import { commandResponse } from "./ContactMutationTestUtils";
import { contactA, contactsHost, deferred } from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts shared command operation gate", () => {
  it("admits managed productivity first and rejects primary plus legacy commands", async () => {
    const command = deferred<Response>();
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const props = hookProps();
    const { result } = renderHook(() => useContactCommands(props));
    let productivity!: Promise<boolean>;
    let primary!: Promise<boolean>;
    let legacy!: Promise<boolean>;
    act(() => {
      productivity = result.current.addNote();
      primary = result.current.saveDraft();
      legacy = result.current.addSelectedContactToGroup("group-a");
    });

    await expect(primary).resolves.toBe(false);
    await expect(legacy).resolves.toBe(false);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(commandType(fetchMock)).toBe("AddContactNote");
    expect(props.data.api).not.toHaveBeenCalled();
    expect(props.data.refresh).not.toHaveBeenCalled();
    expect(props.setNoteText).not.toHaveBeenCalled();

    await act(async () => {
      command.resolve(commandResponse(contactA));
      await productivity;
    });
    await act(async () => {
      await expect(result.current.addSelectedContactToGroup("group-a"))
        .resolves.toBe(true);
    });
    expect(props.data.api).toHaveBeenCalledTimes(1);
  });

  it("admits a primary command first and rejects productivity plus legacy commands", async () => {
    const command = deferred<Response>();
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const props = hookProps();
    const { result } = renderHook(() => useContactCommands(props));
    let primary!: Promise<boolean>;
    let productivity!: Promise<boolean>;
    let legacy!: Promise<boolean>;
    act(() => {
      primary = result.current.saveDraft();
      productivity = result.current.addNote();
      legacy = result.current.addSelectedContactToGroup("group-a");
    });

    await expect(productivity).resolves.toBe(false);
    await expect(legacy).resolves.toBe(false);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(commandType(fetchMock)).toBe("UpdateContact");
    expect(props.data.api).not.toHaveBeenCalled();

    await act(async () => {
      command.resolve(commandResponse(contactA));
      await primary;
    });
  });

  it("admits legacy first and rejects same-tick primary plus productivity commands", async () => {
    const legacyResponse = deferred<typeof succeededResponse>();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const data = contactData(contactA);
    vi.mocked(data.api).mockImplementation(() => legacyResponse.promise);
    const props = hookProps({ data });
    const { result } = renderHook(() => useContactCommands(props));
    let legacy!: Promise<boolean>;
    let primary!: Promise<boolean>;
    let productivity!: Promise<boolean>;
    act(() => {
      legacy = result.current.addSelectedContactToGroup("group-a");
      primary = result.current.saveDraft();
      productivity = result.current.addNote();
    });

    await expect(primary).resolves.toBe(false);
    await expect(productivity).resolves.toBe(false);
    expect(data.api).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      legacyResponse.resolve(succeededResponse);
      await legacy;
    });
    expect(data.refresh).toHaveBeenCalledTimes(1);
    expect(data.loadContactDetail).toHaveBeenCalledTimes(1);
    expect(props.setNoteText).not.toHaveBeenCalled();
  });

  it.each(["failed", "deferred"])(
    "blocks primary and legacy throughout productivity %s reconciliation",
    async (kind) => {
      const fetchMock = vi.fn().mockResolvedValue(commandResponse(contactA));
      vi.stubGlobal("fetch", fetchMock);
      const reconcilePrimaryContacts = vi.fn()
        .mockResolvedValueOnce(kind === "failed"
          ? { kind: "failed", error: new Error("reads unavailable") }
          : { kind: "deferred" })
        .mockResolvedValueOnce({
          kind: "applied",
          preferenceCurrent: true,
          selectedId: contactA.id,
        });
      const data = contactData(contactA, reconcilePrimaryContacts);
      const props = hookProps({ data });
      const { result } = renderHook(() => useContactCommands(props));

      await act(async () => {
        await expect(result.current.addNote()).resolves.toBe(false);
      });
      vi.mocked(data.api).mockClear();
      vi.mocked(data.refresh).mockClear();
      vi.mocked(data.setBusyAction).mockClear();
      vi.mocked(props.setNoteText).mockClear();
      await act(async () => {
        await expect(result.current.saveDraft()).resolves.toBe(false);
        await expect(result.current.addSelectedContactToGroup("group-a"))
          .resolves.toBe(false);
      });
      expect(data.api).not.toHaveBeenCalled();
      expect(data.refresh).not.toHaveBeenCalled();
      expect(data.setBusyAction).not.toHaveBeenCalled();
      expect(props.setNoteText).not.toHaveBeenCalled();

      await act(async () => {
        await expect(result.current.retryPendingReconciliation())
          .resolves.toBe(true);
        await expect(result.current.addSelectedContactToGroup("group-a"))
          .resolves.toBe(true);
      });
      expect(reconcilePrimaryContacts).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(data.api).toHaveBeenCalledTimes(1);
    },
  );
});

function hookProps(overrides: Record<string, unknown> = {}) {
  return {
    creating: false,
    data: contactData(contactA),
    draft: draftFromContact(contactA),
    editing: true,
    host: contactsHost(),
    noteText: "Legacy note",
    operational: true,
    relationshipTarget: "contact-b",
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

function contactData(
  contact: ContactRecord,
  reconcilePrimaryContacts = vi.fn().mockResolvedValue({
    kind: "applied",
    preferenceCurrent: true,
    selectedId: contact.id,
  }),
): ContactData {
  return {
    api: vi.fn().mockResolvedValue(succeededResponse),
    contactMutationInteraction: { criteriaGeneration: 1,
      selectionGeneration: 1, selectedId: contact.id,
      selectedRevision: contact.updated_at || "" },
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

function commandType(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).command_type;
}
