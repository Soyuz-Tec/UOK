import type { ContactCommandResponse } from "../contracts";
import type {
  ContactMutationCapability,
  ContactMutationEffect,
} from "./contactMutationAuthority";

export type ContactManagedCommand =
  | "AddContactNote"
  | "LinkContactRelationship"
  | "RemoveContactRelationship"
  | "CreateContact"
  | "UpdateContact"
  | "ArchiveContact"
  | "RestoreContact"
  | "UpdateContactRelationship";

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

export type ContactManagedRunner = (input: {
  action: ContactManagedCommand;
  capability?: ContactMutationCapability;
  payload: Record<string, unknown>;
  intentIsCurrent: () => boolean;
  preferredId: (response?: ContactCommandResponse) => string | undefined;
  onSuccess?: () => void;
}) => Promise<boolean>;

export type ContactCommandOperation = Omit<
  ContactCommandRunInput,
  "execute" | "preferredSelectedId"
> & {
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

export function retainedContactCommandError(error: unknown) {
  return new Error(
    error instanceof Error
      ? error.message
      : "The Contacts command failed; authoritative state was reconciled.",
  );
}

export function contactCommandBusyAction(
  operation: ContactCommandOperation | null,
  current: boolean,
) {
  return operation ? current ? operation.action : "reconcile" : "";
}
