import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommands } from "../../web/src/app/useContactCommands";
import { commandResponse } from "./ContactMutationTestUtils";
import {
  commandEnvelope,
  contactWithRelationship,
  currentEditorIntent,
  productivityContactData,
  productivityHookProps,
  type Commands,
} from "./ContactProductivityCommandTestUtils";
import { contactA, contactB, contactsHost, deferred } from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts productivity command dispatch", () => {
  it.each([
    [
      "note",
      "AddContactNote",
      { party_id: contactA.id, body: "Private productivity note" },
      (commands: Commands) => commands.addNote(),
    ],
    [
      "link",
      "LinkContactRelationship",
      {
        from_party_id: contactA.id,
        to_party_id: contactB.id,
        relationship_type: "works_for",
      },
      (commands: Commands) => commands.linkRelationship(),
    ],
    [
      "relationship update",
      "UpdateContactRelationship",
      {
        relationship_id: "relationship-a",
        from_party_id: contactA.id,
        to_party_id: contactB.id,
        relationship_type: "billing_contact",
      },
      (commands: Commands) => commands.updateRelationship(
        "relationship-a",
        contactA.id,
        contactB.id,
        "billing_contact",
        currentEditorIntent(),
      ),
    ],
    [
      "relationship removal",
      "RemoveContactRelationship",
      { relationship_id: "relationship-a" },
      (commands: Commands) => commands.removeRelationship("relationship-a"),
    ],
  ])("dispatches one non-abortable %s with a caller-owned UUID", async (
    _label,
    commandType,
    payload,
    invoke,
  ) => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(uuid);
    const fetchMock = vi.fn().mockResolvedValue(commandResponse(contactA));
    vi.stubGlobal("fetch", fetchMock);
    const selected = commandType === "UpdateContactRelationship"
      || commandType === "RemoveContactRelationship"
      ? contactWithRelationship
      : contactA;
    const props = productivityHookProps({
      data: productivityContactData(selected),
    });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => {
      await expect(invoke(result.current)).resolves.toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(commandEnvelope(fetchMock)).toEqual({
      command_type: commandType,
      payload,
      idempotency_key: `contact-${commandType}:${uuid}`,
    });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
    expect(props.data.reconcilePrimaryContacts).toHaveBeenCalledTimes(1);
  });

  it("applies only current note and relationship-composer success effects", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(commandResponse(contactA))
      .mockResolvedValueOnce(commandResponse(contactA));
    vi.stubGlobal("fetch", fetchMock);
    const host = contactsHost({ refreshHost: vi.fn().mockResolvedValue(undefined) });
    const props = productivityHookProps({ host });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => {
      await expect(result.current.addNote()).resolves.toBe(true);
      await expect(result.current.linkRelationship()).resolves.toBe(true);
    });

    expect(props.setNoteText).toHaveBeenCalledWith("");
    expect(props.setRelationshipTarget).toHaveBeenCalledWith("");
    expect(props.data.setOut).toHaveBeenLastCalledWith(null);
    expect(props.data.supersedeReadsForMutation).toHaveBeenCalledTimes(2);
    expect(result.current.productivityRefreshGeneration).toBe(2);
    await waitFor(() => expect(host.refreshHost).toHaveBeenCalledTimes(2));
  });

  it("publishes the command identity only while its current operation is busy", async () => {
    const command = deferred<Response>();
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useContactCommands(
      productivityHookProps(),
    ));
    let operation!: Promise<boolean>;
    act(() => { operation = result.current.addNote(); });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.busyAction).toBe("AddContactNote");

    await act(async () => {
      command.resolve(commandResponse(contactA));
      await operation;
    });
    expect(result.current.busyAction).toBe("");
  });
});
