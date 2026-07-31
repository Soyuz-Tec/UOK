import { describe, expect, it, vi } from "vitest";

import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  beginContactMutationEffect,
  contactMutationBoundary,
  contactMutationCapabilities,
  contactMutationDispatchSnapshot,
  contactMutationIdempotencyKey,
  isContactMutationDispatchCurrent,
  sameContactMutationBoundary,
  sameContactMutationInteraction,
  type ContactMutationInteraction,
} from "../../web/src/app/contactMutationAuthority";
import { contactsHost } from "./ContactReadTestUtils";

describe("Contacts mutation authority", () => {
  it("maps only current command roles to primary-party capabilities", () => {
    expect(contactMutationCapabilities("platform_admin")).toMatchObject({
      canManage: true,
      canRestore: true,
    });
    expect(contactMutationCapabilities("ops_manager")).toMatchObject({
      canManage: true,
      canRestore: true,
    });
    for (const role of ["viewer", "trader", "finance_manager"]) {
      expect(contactMutationCapabilities(role)).toMatchObject({
        canManage: false,
        canRestore: false,
      });
    }
  });

  it("includes session, role, capability, operational, and surface state", () => {
    const current = contactMutationBoundary(contactsHost(), true);
    expect(sameContactMutationBoundary(current, {
      ...current,
      generation: current.generation + 1,
    })).toBe(false);
    expect(sameContactMutationBoundary(current, {
      ...current,
      role: "viewer",
      capabilities: contactMutationCapabilities("viewer"),
    })).toBe(false);
    expect(sameContactMutationBoundary(current, {
      ...current,
      operational: false,
    })).toBe(false);
    expect(sameContactMutationBoundary(current, {
      ...current,
      surfaceActive: false,
    })).toBe(false);
  });

  it.each([
    ["filter", { criteriaGeneration: 2 }],
    ["selection", { selectionGeneration: 2, selectedId: "contact-b" }],
    ["revision", { selectedRevision: "2026-07-31T12:00:00Z" }],
  ])("rejects a changed %s interaction before dispatch", (_label, change) => {
    const boundary = contactMutationBoundary(contactsHost(), true);
    const current = interaction();
    const captured = contactMutationDispatchSnapshot(boundary, current, "manage");
    const changed = { ...current, ...change };

    expect(sameContactMutationInteraction(current, changed)).toBe(false);
    expect(isContactMutationDispatchCurrent(
      captured,
      boundary,
      changed,
    )).toBe(false);
  });

  it("fails same-token and role ABA closed through the authority epoch", () => {
    const authority = createRequestAuthority();
    const boundary = contactMutationBoundary(contactsHost(), true);
    const boundaryRef = { current: boundary };
    const interactionRef = { current: interaction() };
    const effect = beginContactMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      { current: vi.fn() },
      "manage",
    );

    boundaryRef.current = { ...boundary, generation: 1, role: "viewer" };
    authority.invalidate();
    boundaryRef.current = boundary;
    authority.invalidate();

    expect(effect.isCurrent()).toBe(false);
  });

  it("dispatches current unauthorized handling once without a signal", () => {
    const authority = createRequestAuthority();
    const boundaryRef = {
      current: contactMutationBoundary(contactsHost(), true),
    };
    const interactionRef = { current: interaction() };
    const onUnauthorized = { current: vi.fn() };
    const effect = beginContactMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      onUnauthorized,
      "manage",
    );

    expect(effect.request).not.toHaveProperty("signal");
    effect.request.onUnauthorized();
    effect.request.onUnauthorized();
    expect(onUnauthorized.current).toHaveBeenCalledTimes(1);
  });

  it("keeps stale unauthorized handling inert", () => {
    const authority = createRequestAuthority();
    const boundaryRef = {
      current: contactMutationBoundary(contactsHost(), true),
    };
    const interactionRef = { current: interaction() };
    const onUnauthorized = { current: vi.fn() };
    const effect = beginContactMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      onUnauthorized,
      "manage",
    );
    interactionRef.current = { ...interactionRef.current, selectionGeneration: 2 };

    effect.request.onUnauthorized();
    expect(onUnauthorized.current).not.toHaveBeenCalled();
  });

  it("builds action-scoped caller-stable UUID keys", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    expect(contactMutationIdempotencyKey("create", uuid)).toContain("create");
    expect(contactMutationIdempotencyKey("create", uuid)).toContain(uuid);
    expect(contactMutationIdempotencyKey("update", uuid))
      .not.toBe(contactMutationIdempotencyKey("create", uuid));
  });
});

function interaction(
  overrides: Partial<ContactMutationInteraction> = {},
): ContactMutationInteraction {
  return {
    criteriaGeneration: 1,
    selectedId: "contact-a",
    selectedRevision: "2026-07-31T10:00:00Z",
    selectionGeneration: 1,
    ...overrides,
  };
}
