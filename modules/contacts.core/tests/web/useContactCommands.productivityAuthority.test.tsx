import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactCommands } from "../../web/src/app/useContactCommands";
import type { ContactRelationshipEditorIntent } from "../../web/src/types";
import {
  contactWithRelationship,
  currentEditorIntent,
  productivityContactData,
  productivityHookProps,
  type HookProps,
} from "./ContactProductivityCommandTestUtils";
import {
  contactA,
  contactB,
  contactsHost,
  deferred,
  jsonResponse,
} from "./ContactReadTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts productivity command authority", () => {
  it.each([
    ["session", (props: HookProps) => ({
      ...props,
      host: contactsHost({ session: { generation: 1, token: "replacement" } }),
    })],
    ["role", (props: HookProps) => ({
      ...props,
      host: contactsHost({ currentUserRole: "viewer" }),
    })],
    ["operational state", (props: HookProps) => ({
      ...props,
      operational: false,
    })],
    ["surface state", (props: HookProps) => ({
      ...props,
      host: contactsHost({ surfaceActive: false }),
    })],
    ["selection", (props: HookProps) => ({
      ...props,
      data: productivityContactData(contactB, undefined, 2),
    })],
    ["selected revision", (props: HookProps) => ({
      ...props,
      data: productivityContactData({
        ...contactA,
        updated_at: "2026-07-31T16:00:00Z",
      }),
    })],
  ])("fails a note %s transition closed before dispatch", async (
    _label,
    replace,
  ) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const initial = productivityHookProps();
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    let operation!: Promise<boolean>;

    act(() => {
      operation = view.result.current.addNote();
      view.rerender({ props: replace(initial) });
    });
    await act(async () => operation);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(initial.setNoteText).not.toHaveBeenCalled();
  });

  it("fails note and relationship-composer A-B-A intent changes closed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const initial = productivityHookProps();
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    let note!: Promise<boolean>;
    act(() => { note = view.result.current.addNote(); });
    view.rerender({ props: productivityHookProps({ noteText: "Changed note" }) });
    view.rerender({ props: productivityHookProps() });
    await act(async () => note);

    let link!: Promise<boolean>;
    act(() => { link = view.result.current.linkRelationship(); });
    view.rerender({ props: productivityHookProps({
      relationshipTarget: "contact-c",
      relationshipType: "advisor",
    }) });
    view.rerender({ props: productivityHookProps() });
    await act(async () => link);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(initial.setNoteText).not.toHaveBeenCalled();
    expect(initial.setRelationshipTarget).not.toHaveBeenCalled();
  });

  it("fails a relationship row-editor A-B-A intent change closed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    let currentGeneration = 1;
    const editorIntent: ContactRelationshipEditorIntent = {
      generation: 1,
      isCurrent: (generation) => generation === currentGeneration,
    };
    const view = renderHook(() => useContactCommands(productivityHookProps({
      data: productivityContactData(contactWithRelationship),
    })));
    let operation!: Promise<boolean>;

    act(() => {
      operation = view.result.current.updateRelationship(
        "relationship-a",
        contactA.id,
        contactB.id,
        "billing_contact",
        editorIntent,
      );
      currentGeneration = 2;
      currentGeneration = 3;
    });
    await act(async () => operation);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails component lifetime closed before productivity dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = renderHook(() => useContactCommands(productivityHookProps()));
    let operation!: Promise<boolean>;
    act(() => {
      operation = view.result.current.addNote();
      view.unmount();
    });
    await act(async () => operation);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches current unauthorized handling once without reconciliation", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { detail: "Session expired" },
      401,
    ));
    vi.stubGlobal("fetch", fetchMock);
    const props = productivityHookProps({
      host: contactsHost({ session: { onUnauthorized } }),
    });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => {
      await expect(result.current.addNote()).resolves.toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(props.data.reconcilePrimaryContacts).not.toHaveBeenCalled();
    expect(props.setNoteText).not.toHaveBeenCalled();
  });

  it("keeps an old-session unauthorized productivity response inert", async () => {
    const command = deferred<Response>();
    const fetchMock = vi.fn(() => command.promise);
    vi.stubGlobal("fetch", fetchMock);
    const firstUnauthorized = vi.fn();
    const nextUnauthorized = vi.fn();
    const initial = productivityHookProps({
      host: contactsHost({ session: { onUnauthorized: firstUnauthorized } }),
    });
    const view = renderHook(
      ({ props }) => useContactCommands(props),
      { initialProps: { props: initial } },
    );
    let operation!: Promise<boolean>;
    act(() => { operation = view.result.current.addNote(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    view.rerender({ props: productivityHookProps({
      host: contactsHost({
        session: { generation: 1, token: "next", onUnauthorized: nextUnauthorized },
      }),
    }) });

    await act(async () => {
      command.resolve(jsonResponse({ detail: "Old session" }, 401));
      await operation;
    });

    expect(firstUnauthorized).not.toHaveBeenCalled();
    expect(nextUnauthorized).not.toHaveBeenCalled();
    expect(initial.data.reconcilePrimaryContacts).not.toHaveBeenCalled();
  });

  it("does not let a read-only role dispatch productivity writes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const props = productivityHookProps({
      data: productivityContactData(contactWithRelationship),
      host: contactsHost({ currentUserRole: "viewer" }),
    });
    const { result } = renderHook(() => useContactCommands(props));

    await act(async () => {
      await expect(result.current.addNote()).resolves.toBe(false);
      await expect(result.current.linkRelationship()).resolves.toBe(false);
      await expect(result.current.updateRelationship(
        "relationship-a", contactA.id, contactB.id, "advisor", currentEditorIntent(),
      )).resolves.toBe(false);
      await expect(result.current.removeRelationship("relationship-a"))
        .resolves.toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.data.reconcilePrimaryContacts).not.toHaveBeenCalled();
    expect(props.setNoteText).not.toHaveBeenCalled();
    expect(props.setRelationshipTarget).not.toHaveBeenCalled();
  });
});
