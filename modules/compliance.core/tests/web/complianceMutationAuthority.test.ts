import { describe, expect, it, vi } from "vitest";

import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  beginComplianceMutationEffect,
  complianceMutationBoundary,
  complianceMutationDispatchEnabled,
  complianceMutationDispatchSnapshot,
  complianceMutationIdempotencyKey,
  isComplianceMutationDispatchCurrent,
  sameComplianceMutationBoundary,
  sameComplianceMutationInteraction,
  type ComplianceMutationInteraction,
} from "../../web/src/complianceMutationAuthority";
import { complianceHost } from "./ComplianceDocumentTypeWorkspace.testUtils";

const interaction: ComplianceMutationInteraction = {
  criteriaGeneration: 2,
  selectionGeneration: 4,
  selectedId: "document-type-1",
  selectedVersion: 3,
};

describe("Compliance mutation authority", () => {
  it("captures every dispatch boundary while ignoring presentation-only appearance", () => {
    const initial = complianceMutationBoundary(complianceHost(), true, true);
    const dark = complianceMutationBoundary(
      complianceHost({ appearance: "dark" }),
      true,
      true,
    );

    expect(sameComplianceMutationBoundary(initial, dark)).toBe(true);
    expect(complianceMutationDispatchEnabled(initial)).toBe(true);
    expect(complianceMutationDispatchEnabled({ ...initial, token: "" })).toBe(false);
    expect(complianceMutationDispatchEnabled({ ...initial, canManage: false })).toBe(false);
    expect(complianceMutationDispatchEnabled({ ...initial, operational: false })).toBe(false);
    expect(complianceMutationDispatchEnabled({ ...initial, surfaceActive: false })).toBe(false);
  });

  it("rejects same-value ABA boundaries and interactions through generations", () => {
    const boundary = complianceMutationBoundary(complianceHost(), true, true);
    const captured = complianceMutationDispatchSnapshot(boundary, interaction);
    const replacementBoundary = { ...boundary, generation: boundary.generation + 2 };
    const replacementInteraction = {
      ...interaction,
      criteriaGeneration: interaction.criteriaGeneration + 2,
    };

    expect(isComplianceMutationDispatchCurrent(
      captured,
      boundary,
      interaction,
    )).toBe(true);
    expect(isComplianceMutationDispatchCurrent(
      captured,
      replacementBoundary,
      interaction,
    )).toBe(false);
    expect(isComplianceMutationDispatchCurrent(
      captured,
      boundary,
      replacementInteraction,
    )).toBe(false);
    expect(sameComplianceMutationInteraction(interaction, replacementInteraction))
      .toBe(false);
  });

  it("guards effects across role, capability, selection, and version changes", () => {
    const authority = createRequestAuthority();
    const boundary = complianceMutationBoundary(complianceHost(), true, true);
    const boundaryRef = { current: boundary };
    const interactionRef = { current: interaction };
    const effect = beginComplianceMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      { current: vi.fn() },
    );
    const commit = vi.fn();

    expect(effect.runIfCurrent(commit)).toBeUndefined();
    expect(commit).toHaveBeenCalledTimes(1);

    boundaryRef.current = { ...boundary, role: "trader" };
    effect.runIfCurrent(commit);
    expect(effect.isCurrent()).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);

    const successor = beginComplianceMutationEffect(
      authority,
      { current: boundary },
      { current: { ...interaction, selectedVersion: 4 } },
      { current: vi.fn() },
    );
    expect(successor.isCurrent()).toBe(true);
    expect(effect.isCurrent()).toBe(false);
  });

  it("dispatches current unauthorized handling once without exposing a command signal", () => {
    const authority = createRequestAuthority();
    const boundary = complianceMutationBoundary(complianceHost(), true, true);
    const unauthorized = vi.fn();
    const effect = beginComplianceMutationEffect(
      authority,
      { current: boundary },
      { current: interaction },
      { current: unauthorized },
    );
    const startingEpoch = authority.epoch;

    expect("signal" in effect.request).toBe(false);
    effect.request.onUnauthorized();
    effect.request.onUnauthorized();

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(authority.epoch).toBeGreaterThan(startingEpoch);
    expect(effect.isCurrent()).toBe(false);
  });

  it("turns stale unauthorized handling into a no-op", () => {
    const authority = createRequestAuthority();
    const boundary = complianceMutationBoundary(complianceHost(), true, true);
    const boundaryRef = { current: boundary };
    const interactionRef = { current: interaction };
    const unauthorized = vi.fn();
    const effect = beginComplianceMutationEffect(
      authority,
      boundaryRef,
      interactionRef,
      { current: unauthorized },
    );

    interactionRef.current = {
      ...interaction,
      selectionGeneration: interaction.selectionGeneration + 1,
    };
    effect.request.onUnauthorized();

    expect(unauthorized).not.toHaveBeenCalled();
    expect(authority.epoch).toBe(0);
  });

  it("builds caller-stable, action-scoped idempotency keys", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";

    expect(complianceMutationIdempotencyKey("update", uuid))
      .toBe(`compliance-document-type-update:${uuid}`);
    expect(complianceMutationIdempotencyKey("update", uuid))
      .toBe(complianceMutationIdempotencyKey("update", uuid));
    expect(complianceMutationIdempotencyKey("archive", uuid))
      .not.toBe(complianceMutationIdempotencyKey("update", uuid));
  });
});
