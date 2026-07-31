import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactData } from "../../web/src/app/useContactData";
import {
  contactA,
  contactARevision,
  contactB,
  contactFilters,
  contactsHost,
  groupA,
  groupB,
  jsonResponse,
} from "./ContactReadTestUtils";
import { createContactMutationFetchController } from "./ContactMutationTestUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts primary mutation reconciliation", () => {
  it("atomically applies current list, groups, selection, and detail", async () => {
    const controller = createContactMutationFetchController({
      rows: [contactA],
      groups: [groupA],
    });
    vi.stubGlobal("fetch", controller.fetch);
    const { result } = renderHook(() => useContactData(
      contactsHost(),
      true,
      contactFilters(),
    ));
    await waitFor(() => expect(result.current.selectedContact).toEqual(contactA));

    controller.upsert(contactARevision);
    controller.setGroups([groupB]);
    let reconciliation: Awaited<ReturnType<
      typeof result.current.reconcilePrimaryContacts
    >> | undefined;
    await act(async () => {
      reconciliation = await result.current.reconcilePrimaryContacts({
        preferredSelectedId: contactA.id,
        preferenceIsCurrent: () => true,
      });
    });

    expect(reconciliation).toEqual({
      kind: "applied",
      preferenceCurrent: true,
      selectedId: contactA.id,
    });
    expect(result.current.contacts).toEqual([contactARevision]);
    expect(result.current.contactGroups).toEqual([groupB]);
    expect(result.current.selectedContact).toEqual(contactARevision);
  });

  it("keeps committed state after failure and permits a read-only retry", async () => {
    const controller = createContactMutationFetchController({
      rows: [contactA],
      groups: [groupA],
    });
    vi.stubGlobal("fetch", controller.fetch);
    const { result } = renderHook(() => useContactData(
      contactsHost(),
      true,
      contactFilters(),
    ));
    await waitFor(() => expect(result.current.selectedContact).toEqual(contactA));
    controller.upsert(contactARevision);
    controller.planNext("list", () => jsonResponse(
      { detail: "reconciliation unavailable" },
      503,
    ));

    let failed: Awaited<ReturnType<
      typeof result.current.reconcilePrimaryContacts
    >> | undefined;
    await act(async () => {
      failed = await result.current.reconcilePrimaryContacts();
    });
    expect(failed).toMatchObject({ kind: "failed" });
    expect(result.current.contacts).toEqual([contactA]);

    let retried: Awaited<ReturnType<
      typeof result.current.reconcilePrimaryContacts
    >> | undefined;
    await act(async () => {
      retried = await result.current.reconcilePrimaryContacts();
    });
    expect(retried).toMatchObject({ kind: "applied" });
    expect(result.current.contacts).toEqual([contactARevision]);
    expect(controller.requestsOf("command")).toHaveLength(0);
  });

  it("does not force a response-hint ID absent from current GET state", async () => {
    const controller = createContactMutationFetchController({ rows: [contactA] });
    vi.stubGlobal("fetch", controller.fetch);
    const { result } = renderHook(() => useContactData(
      contactsHost(), true, contactFilters(),
    ));
    await waitFor(() => expect(result.current.selectedContact).toEqual(contactA));

    await act(async () => {
      await result.current.reconcilePrimaryContacts({
        preferredSelectedId: "response-only-contact",
        preferenceIsCurrent: () => true,
      });
    });

    expect(result.current.selectedContactId).toBe(contactA.id);
    expect(controller.requestsOf("detail:response-only-contact")).toHaveLength(0);
  });

  it("rejects a detail completion after selection A-B-A", async () => {
    const controller = createContactMutationFetchController({
      rows: [contactA, contactB],
    });
    vi.stubGlobal("fetch", controller.fetch);
    const { result } = renderHook(() => useContactData(
      contactsHost(), true, contactFilters(),
    ));
    await waitFor(() => expect(result.current.selectedContact).toEqual(contactA));
    const staleDetail = controller.deferNext(`detail:${contactA.id}`);
    let reconciliation!: ReturnType<typeof result.current.reconcilePrimaryContacts>;
    act(() => { reconciliation = result.current.reconcilePrimaryContacts(); });
    await waitFor(() => expect(
      controller.requestsOf(`detail:${contactA.id}`),
    ).toHaveLength(2));

    act(() => result.current.setSelectedContactId(contactB.id));
    await waitFor(() => expect(result.current.selectedContactId).toBe(contactB.id));
    act(() => result.current.setSelectedContactId(contactA.id));
    await waitFor(() => expect(result.current.selectedContactId).toBe(contactA.id));
    let outcome;
    await act(async () => {
      staleDetail.resolve(jsonResponse({
        ...contactA,
        email: "stale-reconciliation@example.test",
      }));
      outcome = await reconciliation;
    });

    expect(outcome).toEqual({ kind: "superseded" });
    expect(result.current.selectedContact?.email)
      .not.toBe("stale-reconciliation@example.test");
  });

  it("returns deferred instead of failed for a reconciliation 401", async () => {
    const onUnauthorized = vi.fn();
    const controller = createContactMutationFetchController({ rows: [contactA] });
    vi.stubGlobal("fetch", controller.fetch);
    const { result } = renderHook(() => useContactData(
      contactsHost({ session: { onUnauthorized } }),
      true,
      contactFilters(),
    ));
    await waitFor(() => expect(result.current.selectedContact).toEqual(contactA));
    controller.planNext("list", () => jsonResponse(
      { detail: "session expired" },
      401,
    ));
    let outcome;
    await act(async () => {
      outcome = await result.current.reconcilePrimaryContacts();
    });

    expect(outcome).toEqual({ kind: "deferred" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
