import type { ContactCommandResponse } from "../contracts";
import type {
  ContactMutationCapability,
  ContactMutationEffect,
} from "./contactMutationAuthority";

export type ContactManagedCommand =
  | "CreateContact"
  | "UpdateContact"
  | "ArchiveContact"
  | "RestoreContact";

export type ContactCommandRunInput = {
  action: ContactManagedCommand;
  capability: ContactMutationCapability;
  execute: (request: {
    token: string;
    idempotencyKey: string;
    onUnauthorized: () => void;
  }) => Promise<ContactCommandResponse>;
  intentIsCurrent: () => boolean;
  preferredSelectedId: (response?: ContactCommandResponse) => string | undefined;
  onAccepted?: () => void;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onPending: (error?: unknown) => void;
};

export type ContactCommandOperation = ContactCommandRunInput & {
  id: number;
  gateOwner: symbol;
  effect: ContactMutationEffect | null;
  outcome:
    | { kind: "success"; preferredSelectedId?: string }
    | { kind: "error"; error: unknown }
    | null;
  reconciling: boolean;
};

export function redactStaleContactCommandOutcome(
  operation: ContactCommandOperation | null,
) {
  if (operation?.outcome?.kind === "success") {
    operation.outcome = { kind: "success" };
  } else if (operation?.outcome?.kind === "error") {
    operation.outcome = {
      kind: "error",
      error: new Error("A stale Contacts command outcome requires reconciliation."),
    };
  }
}

export function contactCommandBusyAction(
  operation: ContactCommandOperation | null,
  current: boolean,
) {
  return operation ? current ? operation.action : "reconcile" : "";
}
