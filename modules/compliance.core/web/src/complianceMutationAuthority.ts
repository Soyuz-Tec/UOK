import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import type {
  RequestAuthority,
  RequestAuthorityEpoch,
} from "@uok/shared/request-authority";
import type { ComplianceDocumentTypeLifecycleAction } from "./types";

export type ComplianceMutationAction =
  | "create"
  | "update"
  | ComplianceDocumentTypeLifecycleAction;

export type ComplianceMutationBoundary = Readonly<{
  token: string;
  generation: number;
  role: string;
  canManage: boolean;
  operational: boolean;
  surfaceActive: boolean;
}>;

export type ComplianceMutationInteraction = Readonly<{
  criteriaGeneration: number;
  selectionGeneration: number;
  selectedId: string;
  selectedVersion: number | null;
}>;

export type ComplianceMutationDispatchSnapshot = Readonly<{
  boundary: ComplianceMutationBoundary;
  interaction: ComplianceMutationInteraction;
}>;

export type ComplianceMutationEffect = Readonly<{
  epoch: RequestAuthorityEpoch;
  boundary: ComplianceMutationBoundary;
  interaction: ComplianceMutationInteraction;
  isCurrent(): boolean;
  runIfCurrent<Result>(effect: () => Result): Result | undefined;
  request: Readonly<{
    onUnauthorized(): void;
  }>;
  release(): void;
}>;

type CurrentRef<Value> = {
  current: Value;
};

export function complianceMutationBoundary(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  canManage: boolean,
): ComplianceMutationBoundary {
  return {
    token: host.session.token,
    generation: host.session.generation,
    role: host.currentUserRole,
    canManage,
    operational,
    surfaceActive: host.surfaceActive,
  };
}

export function sameComplianceMutationBoundary(
  left: ComplianceMutationBoundary,
  right: ComplianceMutationBoundary,
) {
  return left.token === right.token
    && left.generation === right.generation
    && left.role === right.role
    && left.canManage === right.canManage
    && left.operational === right.operational
    && left.surfaceActive === right.surfaceActive;
}

export function sameComplianceMutationInteraction(
  left: ComplianceMutationInteraction,
  right: ComplianceMutationInteraction,
) {
  return left.criteriaGeneration === right.criteriaGeneration
    && left.selectionGeneration === right.selectionGeneration
    && left.selectedId === right.selectedId
    && left.selectedVersion === right.selectedVersion;
}

export function complianceMutationDispatchEnabled(
  boundary: ComplianceMutationBoundary,
) {
  return Boolean(
    boundary.token
    && boundary.canManage
    && boundary.operational
    && boundary.surfaceActive,
  );
}

export function complianceMutationDispatchSnapshot(
  boundary: ComplianceMutationBoundary,
  interaction: ComplianceMutationInteraction,
): ComplianceMutationDispatchSnapshot {
  return {
    boundary: { ...boundary },
    interaction: { ...interaction },
  };
}

export function isComplianceMutationDispatchCurrent(
  captured: ComplianceMutationDispatchSnapshot,
  boundary: ComplianceMutationBoundary,
  interaction: ComplianceMutationInteraction,
) {
  return complianceMutationDispatchEnabled(captured.boundary)
    && complianceMutationDispatchEnabled(boundary)
    && sameComplianceMutationBoundary(captured.boundary, boundary)
    && sameComplianceMutationInteraction(captured.interaction, interaction);
}

export function beginComplianceMutationEffect(
  authority: RequestAuthority,
  boundaryRef: CurrentRef<ComplianceMutationBoundary>,
  interactionRef: CurrentRef<ComplianceMutationInteraction>,
  onUnauthorizedRef: CurrentRef<() => void>,
  lane = "mutation-effects",
): ComplianceMutationEffect {
  const captured = complianceMutationDispatchSnapshot(
    boundaryRef.current,
    interactionRef.current,
  );
  const ticket = authority.begin(lane);
  const isCurrent = () => (
    ticket.isCurrent()
    && isComplianceMutationDispatchCurrent(
      captured,
      boundaryRef.current,
      interactionRef.current,
    )
  );
  const unauthorized = ticket.onceIfCurrent(() => {
    if (!isCurrent()) return;
    authority.invalidate();
    onUnauthorizedRef.current();
  });

  return {
    epoch: ticket.epoch,
    boundary: captured.boundary,
    interaction: captured.interaction,
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

export function complianceMutationIdempotencyKey(
  action: ComplianceMutationAction,
  uuid = crypto.randomUUID(),
) {
  return `compliance-document-type-${action}:${uuid}`;
}
