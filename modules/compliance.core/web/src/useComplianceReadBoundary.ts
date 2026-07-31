import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  beginComplianceRead,
  complianceReadBoundary,
  complianceReadyStatus,
  sameComplianceReadBoundary,
} from "./complianceReadAuthority";

export function useComplianceReadBoundary(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  setStatus: (value: string) => void,
) {
  const [authority] = useState(createRequestAuthority);
  const boundary = useMemo(() => complianceReadBoundary(
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
  const updateStatus = useRef(setStatus);
  const listStatus = useRef(complianceReadyStatus);
  const onUnauthorized = useRef(host.session.onUnauthorized);
  const [, renderInvalidation] = useState(0);
  updateStatus.current = setStatus;
  onUnauthorized.current = host.session.onUnauthorized;

  useLayoutEffect(() => {
    if (sameComplianceReadBoundary(boundaryRef.current, boundary)) return;
    boundaryRef.current = boundary;
    authority.invalidate();
    listStatus.current = complianceReadyStatus;
    updateStatus.current(complianceReadyStatus);
    renderInvalidation((current) => current + 1);
  }, [authority, boundary]);

  const beginRead = useCallback((lane: string) => beginComplianceRead(
    authority,
    boundaryRef,
    onUnauthorized,
    () => {
      listStatus.current = complianceReadyStatus;
      updateStatus.current(complianceReadyStatus);
      renderInvalidation((current) => current + 1);
    },
    lane,
  ), [authority]);

  return {
    authority,
    boundary,
    boundaryRef,
    beginRead,
    listStatus,
    updateStatus,
  };
}
