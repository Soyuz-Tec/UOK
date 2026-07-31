export type ContactCommandOperationGate = {
  owner: symbol | null;
};

export function createContactCommandOperationGate(): ContactCommandOperationGate {
  return { owner: null };
}

export function acquireContactCommandOperationGate(
  gate: ContactCommandOperationGate,
) {
  if (gate.owner) return null;
  const owner = Symbol("contact-command-operation");
  gate.owner = owner;
  return owner;
}

export function releaseContactCommandOperationGate(
  gate: ContactCommandOperationGate,
  owner: symbol,
) {
  if (gate.owner === owner) gate.owner = null;
}
