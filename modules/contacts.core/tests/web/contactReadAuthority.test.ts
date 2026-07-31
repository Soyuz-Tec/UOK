import { describe, expect, it, vi } from "vitest";

import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  advanceContactDetailCriteria,
  advanceContactListCriteria,
  beginContactRead,
  contactDetailCriteria,
  contactListCriteria,
  contactReadBoundary,
  contactReadsEnabled,
  sameContactReadBoundary,
} from "../../web/src/app/contactReadAuthority";
import { contactFilters } from "./ContactReadTestUtils";

describe("Contacts primary-read authority helpers", () => {
  it("treats every authorization fact as boundary identity", () => {
    const base = contactReadBoundary("token", 4, "ops_manager", true, true);
    expect(contactReadsEnabled(base)).toBe(true);
    expect(sameContactReadBoundary(base, { ...base })).toBe(true);

    for (const candidate of [
      { ...base, token: "replacement" },
      { ...base, generation: 5 },
      { ...base, role: "viewer" },
      { ...base, operational: false },
      { ...base, surfaceActive: false },
    ]) {
      expect(sameContactReadBoundary(base, candidate)).toBe(false);
    }
    expect(contactReadsEnabled({ ...base, token: "" })).toBe(false);
    expect(contactReadsEnabled({ ...base, operational: false })).toBe(false);
    expect(contactReadsEnabled({ ...base, surfaceActive: false })).toBe(false);
  });

  it("advances list criteria monotonically through an A to B to A change", () => {
    const authority = createRequestAuthority();
    const criteriaA = contactListCriteria(contactFilters());
    const criteriaB = contactListCriteria(contactFilters({
      query: "beta",
      contactGroupId: "group-b",
      statusFilter: "archived",
      reviewFilter: "needs_review",
      typeFilter: "organization",
      sourceFilter: "gmail",
      qualityFilter: "duplicate_risk",
      contactPage: 2,
      contactPageSize: 50,
      contactSortBy: "display_name",
      contactSortDir: "asc",
    }));
    const criteriaRef = { current: { value: criteriaA, generation: 0 } };
    const pending = authority.begin("list");

    expect(criteriaB).not.toBe(criteriaA);
    expect(advanceContactListCriteria(authority, criteriaRef, criteriaB)).toBe(1);
    expect(pending.isCurrent()).toBe(false);
    expect(advanceContactListCriteria(authority, criteriaRef, criteriaA)).toBe(2);
    expect(criteriaRef.current).toEqual({ value: criteriaA, generation: 2 });
  });

  it("uses Party ID and row revision for ABA-safe detail criteria", () => {
    const authority = createRequestAuthority();
    const firstA = contactDetailCriteria("contact-a", "revision-1");
    const b = contactDetailCriteria("contact-b", "revision-1");
    const secondA = contactDetailCriteria("contact-a", "revision-2");
    const criteriaRef = { current: { value: firstA, generation: 0 } };
    const pending = authority.begin("detail");

    expect(advanceContactDetailCriteria(authority, criteriaRef, b)).toBe(1);
    expect(pending.isCurrent()).toBe(false);
    expect(advanceContactDetailCriteria(authority, criteriaRef, secondA)).toBe(2);
    expect(firstA).not.toBe(secondA);
    expect(criteriaRef.current).toEqual({ value: secondA, generation: 2 });
  });

  it("runs one current unauthorized decision and suppresses stale decisions", () => {
    const authority = createRequestAuthority();
    const boundaryRef = {
      current: contactReadBoundary("token", 0, "ops_manager", true, true),
    };
    const onUnauthorized = { current: vi.fn() };
    const onInvalidated = vi.fn();
    const stale = beginContactRead(
      authority,
      boundaryRef,
      onUnauthorized,
      onInvalidated,
      "list",
    );
    beginContactRead(
      authority,
      boundaryRef,
      onUnauthorized,
      onInvalidated,
      "list",
    );
    stale.request.onUnauthorized();
    expect(onUnauthorized.current).not.toHaveBeenCalled();

    const current = beginContactRead(
      authority,
      boundaryRef,
      onUnauthorized,
      onInvalidated,
      "groups",
    );
    current.request.onUnauthorized();
    current.request.onUnauthorized();
    expect(onInvalidated).toHaveBeenCalledTimes(1);
    expect(onUnauthorized.current).toHaveBeenCalledTimes(1);
  });
});
