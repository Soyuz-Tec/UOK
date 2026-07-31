import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { createRequestAuthority } from "@uok/shared/request-authority";

import {
  beginContactRead,
  contactReadBoundary,
  sameContactReadBoundary,
} from "./contactReadAuthority";

export function useContactReadBoundary(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
) {
  const [authority] = useState(createRequestAuthority);
  const boundary = useMemo(() => contactReadBoundary(
    host.session.token,
    host.session.generation,
    host.currentUserRole,
    operational,
    host.surfaceActive,
  ), [
    host.currentUserRole,
    host.session.generation,
    host.session.token,
    host.surfaceActive,
    operational,
  ]);
  const boundaryRef = useRef(boundary);
  const onUnauthorized = useRef(host.session.onUnauthorized);
  const [, renderInvalidation] = useState(0);
  onUnauthorized.current = host.session.onUnauthorized;

  useLayoutEffect(() => {
    if (sameContactReadBoundary(boundaryRef.current, boundary)) return;
    boundaryRef.current = boundary;
    authority.invalidate();
    renderInvalidation((current) => current + 1);
  }, [authority, boundary]);

  const beginRead = useCallback((lane: string) => beginContactRead(
    authority,
    boundaryRef,
    onUnauthorized,
    () => renderInvalidation((current) => current + 1),
    lane,
  ), [authority]);

  return {
    authority,
    boundary,
    boundaryRef,
    beginRead,
  };
}
