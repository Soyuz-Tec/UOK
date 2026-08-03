import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createRequestAuthority } from "@uok/shared/request-authority";

import {
  beginContactRead,
  sameContactReadBoundary,
  type ContactReadBoundary,
} from "./contactReadAuthority";

export function useContactSecondaryReadAuthority(
  boundary: ContactReadBoundary,
  onUnauthorized: () => void,
) {
  const [authority] = useState(createRequestAuthority);
  const boundaryRef = useRef(boundary);
  const onUnauthorizedRef = useRef(onUnauthorized);
  const [, renderInvalidation] = useState(0);
  onUnauthorizedRef.current = onUnauthorized;
  const boundaryCurrent = sameContactReadBoundary(boundaryRef.current, boundary);

  useLayoutEffect(() => {
    if (sameContactReadBoundary(boundaryRef.current, boundary)) return;
    boundaryRef.current = boundary;
    authority.invalidate();
    renderInvalidation((current) => current + 1);
  }, [authority, boundary]);

  useEffect(() => () => {
    authority.dispose();
  }, [authority]);

  const beginRead = useCallback((lane: string) => beginContactRead(
    authority,
    boundaryRef,
    onUnauthorizedRef,
    () => renderInvalidation((current) => current + 1),
    lane,
  ), [authority]);

  return {
    authority,
    beginRead,
    boundaryCurrent,
    boundaryRef,
  };
}
