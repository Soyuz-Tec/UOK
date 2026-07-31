import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import type {
  RequestAuthority,
  RequestAuthorityEpoch,
} from "@uok/shared/request-authority";

export type ContactMutationCapability = "manage" | "restore";

export type ContactMutationCapabilities = Readonly<{
  canManage: boolean;
  canRestore: boolean;
}>;

export type ContactMutationBoundary = Readonly<{
  token: string;
  generation: number;
  role: string;
  operational: boolean;
  surfaceActive: boolean;
  capabilities: ContactMutationCapabilities;
}>;

export type ContactMutationInteraction = Readonly<{
  criteriaGeneration: number;
  selectionGeneration: number;
  selectedId: string;
  selectedRevision: string;
}>;

export type ContactMutationDispatchSnapshot = Readonly<{
  boundary: ContactMutationBoundary;
  interaction: ContactMutationInteraction;
  capability: ContactMutationCapability;
}>;

export type ContactMutationEffect = Readonly<{
  epoch: RequestAuthorityEpoch;
  isCurrent(): boolean;
  runIfCurrent<Result>(effect: () => Result): Result | undefined;
  request: Readonly<{ onUnauthorized(): void }>;
  release(): void;
}>;

type CurrentRef<Value> = { current: Value };

export function contactMutationCapabilities(role: string): ContactMutationCapabilities {
  const privileged = role === "platform_admin" || role === "ops_manager";
  return { canManage: privileged, canRestore: privileged };
}

export function contactMutationBoundary(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
): ContactMutationBoundary {
  return {
    token: host.session.token,
    generation: host.session.generation,
    role: host.currentUserRole,
    operational,
    surfaceActive: host.surfaceActive,
    capabilities: contactMutationCapabilities(host.currentUserRole),
  };
}

export function sameContactMutationBoundary(
  left: ContactMutationBoundary,
  right: ContactMutationBoundary,
) {
  return left.token === right.token
    && left.generation === right.generation
    && left.role === right.role
    && left.operational === right.operational
    && left.surfaceActive === right.surfaceActive
    && left.capabilities.canManage === right.capabilities.canManage
    && left.capabilities.canRestore === right.capabilities.canRestore;
}

export function sameContactMutationInteraction(
  left: ContactMutationInteraction,
  right: ContactMutationInteraction,
) {
  return left.criteriaGeneration === right.criteriaGeneration
    && left.selectionGeneration === right.selectionGeneration
    && left.selectedId === right.selectedId
    && left.selectedRevision === right.selectedRevision;
}

export function contactMutationDispatchSnapshot(
  boundary: ContactMutationBoundary,
  interaction: ContactMutationInteraction,
  capability: ContactMutationCapability,
): ContactMutationDispatchSnapshot {
  return {
    boundary: {
      ...boundary,
      capabilities: { ...boundary.capabilities },
    },
    interaction: { ...interaction },
    capability,
  };
}

export function isContactMutationDispatchCurrent(
  captured: ContactMutationDispatchSnapshot,
  boundary: ContactMutationBoundary,
  interaction: ContactMutationInteraction,
) {
  return contactMutationDispatchEnabled(captured.boundary, captured.capability)
    && contactMutationDispatchEnabled(boundary, captured.capability)
    && sameContactMutationBoundary(captured.boundary, boundary)
    && sameContactMutationInteraction(captured.interaction, interaction);
}

export function beginContactMutationEffect(
  authority: RequestAuthority,
  boundaryRef: CurrentRef<ContactMutationBoundary>,
  interactionRef: CurrentRef<ContactMutationInteraction>,
  onUnauthorizedRef: CurrentRef<() => void>,
  capability: ContactMutationCapability,
): ContactMutationEffect {
  const captured = contactMutationDispatchSnapshot(
    boundaryRef.current,
    interactionRef.current,
    capability,
  );
  const ticket = authority.begin("mutation-effects");
  const isCurrent = () => ticket.isCurrent()
    && isContactMutationDispatchCurrent(
      captured,
      boundaryRef.current,
      interactionRef.current,
    );
  const unauthorized = ticket.onceIfCurrent(() => {
    if (!isCurrent()) return;
    authority.invalidate();
    onUnauthorizedRef.current();
  });
  return {
    epoch: ticket.epoch,
    isCurrent,
    runIfCurrent<Result>(effect: () => Result) {
      return isCurrent() ? effect() : undefined;
    },
    request: {
      onUnauthorized() {
        if (isCurrent()) unauthorized();
      },
    },
    release: ticket.release,
  };
}

export function contactMutationIdempotencyKey(
  action: string,
  uuid = crypto.randomUUID(),
) {
  return `contact-${action}:${uuid}`;
}

function contactMutationDispatchEnabled(
  boundary: ContactMutationBoundary,
  capability: ContactMutationCapability,
) {
  const authorized = capability === "restore"
    ? boundary.capabilities.canRestore
    : boundary.capabilities.canManage;
  return Boolean(
    boundary.token
    && boundary.operational
    && boundary.surfaceActive
    && authorized,
  );
}
