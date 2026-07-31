import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommands } from "../../web/src/app/useContactCommands";
import type { ContactData } from "../../web/src/app/useContactData";
import { draftFromContact } from "../../web/src/app/contactDraft";
import type { ContactRecord } from "../../web/src/contracts";
import { commandResponse } from "./ContactMutationTestUtils";
import { contactA, contactsHost, deferred } from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts command preflight browser effects", () => {
  it("does not clear outcome for a same-flight rejected duplicate", async () => {
    const command = deferred<Response>();
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const props = hookProps();
    const setOut = vi.mocked(props.data.setOut);
    const { result } = renderHook(() => useContactCommands(props));
    let accepted!: Promise<boolean>;
    act(() => { accepted = result.current.saveDraft(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setOut.mockClear();

    await act(async () => {
      await expect(result.current.saveDraft()).resolves.toBe(false);
    });
    expect(setOut).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      command.resolve(commandResponse(contactA));
      await accepted;
    });
  });

  it("rejects a captured archive after delete eligibility is revoked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const initial = hookProps();
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    const capturedArchive = view.result.current.archiveSelected;
    const replacement = hookProps({
      data: contactData({ ...contactA, can_delete: false }),
    });
    view.rerender({ props: replacement });

    await act(async () => {
      await expect(capturedArchive()).rejects.toThrow(
        "The contact could not be deleted",
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replacement.data.setOut).not.toHaveBeenCalled();
  });

  it("rejects a captured restore after restore eligibility is revoked", async () => {
    const archived = {
      ...contactA,
      status: "archived",
      can_delete: false,
      can_restore: true,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const initial = hookProps({ data: contactData(archived) });
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    const capturedRestore = view.result.current.restoreSelected;
    const replacement = hookProps({
      data: contactData({ ...archived, can_restore: false }),
    });
    view.rerender({ props: replacement });

    await act(async () => {
      await expect(capturedRestore()).resolves.toBe(false);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replacement.data.setOut).not.toHaveBeenCalled();
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
