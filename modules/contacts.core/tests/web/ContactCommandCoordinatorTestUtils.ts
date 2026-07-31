import { vi } from "vitest";

import { ContactCommandApiError } from "../../web/src/app/contactCommandApi";
import { createContactCommandOperationGate } from "../../web/src/app/contactCommandOperationGate";
import type { ContactMutationInteraction } from "../../web/src/app/contactMutationAuthority";
import type { useContactCommandCoordinator } from "../../web/src/app/useContactCommandCoordinator";
import type { ContactCommandResponse } from "../../web/src/contracts";
import { contactsHost, deferred } from "./ContactReadTestUtils";

type CoordinatorProps = Parameters<typeof useContactCommandCoordinator>[0];
type RunInput = Parameters<
  ReturnType<typeof useContactCommandCoordinator>["runOperation"]
>[0];
type Mock = ReturnType<typeof vi.fn>;
type TestRunInput = RunInput & {
  execute: Mock;
  intentIsCurrent: Mock;
  onError: Mock;
  onPending: Mock;
  onSuccess: Mock;
  preferredSelectedId: Mock;
};

export const interactionA: ContactMutationInteraction = {
  criteriaGeneration: 1,
  selectionGeneration: 1,
  selectedId: "contact-a",
  selectedRevision: "2026-07-31T10:00:00Z",
};

export const succeededResponse: ContactCommandResponse = {
  command_id: "command-contact-1",
  idempotent: false,
  result: { id: "contact-a", display_name: "Response Hint" },
  status: "succeeded",
};

export function coordinatorProps(
  overrides: Partial<CoordinatorProps> = {},
): CoordinatorProps {
  return {
    host: contactsHost(),
    interaction: interactionA,
    operationGate: createContactCommandOperationGate(),
    operational: true,
    reconcilePrimaryContacts: vi.fn().mockResolvedValue({
      kind: "applied",
      preferenceCurrent: true,
      selectedId: "contact-a",
    }),
    supersedeReadsForMutation: vi.fn(),
    ...overrides,
  };
}

export function operationInput(
  overrides: Partial<RunInput> = {},
): TestRunInput {
  return {
    action: "UpdateContact",
    capability: "manage",
    execute: vi.fn().mockResolvedValue(succeededResponse),
    intentIsCurrent: vi.fn(() => true),
    onError: vi.fn(),
    onPending: vi.fn(),
    onSuccess: vi.fn(),
    preferredSelectedId: vi.fn(() => "contact-a"),
    ...overrides,
  } as TestRunInput;
}

export function commandError(status: number, ambiguous = false) {
  return new ContactCommandApiError(
    `Command failed with ${status}.`,
    status,
    { detail: `failure-${status}` },
    ambiguous,
  );
}

export function deferredReconciliation() {
  return deferred<Awaited<ReturnType<
    CoordinatorProps["reconcilePrimaryContacts"]
  >>>();
}
