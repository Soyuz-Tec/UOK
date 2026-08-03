import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useContactWorkspaceState } from "../../web/src/app/useContactWorkspaceState";
import type { ContactPreferences } from "../../web/src/app/useContactPreferences";
import { emptyDraft } from "../../web/src/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Contacts workspace session ownership", () => {
  it("retains transient editor state when only the surface deactivates", () => {
    const owner = { token: "token-a", generation: 0 };
    const view = renderHook(
      ({ currentOwner, surfaceActive }) => {
        void surfaceActive;
        return useContactWorkspaceState(preferences, currentOwner);
      },
      { initialProps: { currentOwner: owner, surfaceActive: true } },
    );
    populateTransientState(view.result.current);

    view.rerender({ currentOwner: owner, surfaceActive: false });

    expect(view.result.current.creating).toBe(true);
    expect(view.result.current.editing).toBe(true);
    expect(view.result.current.draft.display_name).toBe("Private Draft");
    expect(view.result.current.noteText).toBe("Private note");
    expect(view.result.current.relationshipTarget).toBe("private-party-id");
  });

  it.each([
    ["token", { token: "token-b", generation: 0 }],
    ["generation", { token: "token-a", generation: 1 }],
  ])("clears transient PII after session %s replacement", (_label, nextOwner) => {
    const view = renderHook(
      ({ owner }) => useContactWorkspaceState(preferences, owner),
      {
        initialProps: {
          owner: { token: "token-a", generation: 0 },
        },
      },
    );
    populateTransientState(view.result.current);

    view.rerender({ owner: nextOwner });

    expect(view.result.current.creating).toBe(false);
    expect(view.result.current.editing).toBe(false);
    expect(view.result.current.draft).toEqual(emptyDraft);
    expect(view.result.current.noteText).toBe("");
    expect(view.result.current.relationshipTarget).toBe("");
    expect(view.result.current.query).toBe("");
    expect(view.result.current.contactGroupId).toBe("");
    expect(view.result.current.statusFilter).toBe("active");
    expect(view.result.current.reviewFilter).toBe("all");
    expect(view.result.current.typeFilter).toBe("all");
    expect(view.result.current.sourceFilter).toBe("all");
    expect(view.result.current.qualityFilter).toBe("all");
    expect(view.result.current.contactPage).toBe(0);
    expect(view.result.current.contactPageSize).toBe(25);
    expect(view.result.current.contactSortBy).toBe("updated_at");
    expect(view.result.current.contactSortDir).toBe("desc");
    expect(view.result.current.contactDetailPane).toBe("overview");
    expect(view.result.current.relationshipType).toBe("primary_contact");
  });

  it("clears note and relationship drafts before a different contact becomes selected", () => {
    const view = renderHook(() => useContactWorkspaceState(
      preferences,
      { token: "token-a", generation: 0 },
    ));

    act(() => {
      view.result.current.setNoteText("Draft for contact A");
      view.result.current.setRelationshipTarget("contact-a-target");
      view.result.current.setRelationshipType("billing_contact");
    });

    act(() => view.result.current.clearSelectionState());

    expect(view.result.current.noteText).toBe("");
    expect(view.result.current.relationshipTarget).toBe("");
    expect(view.result.current.relationshipType).toBe("primary_contact");
  });
});

const preferences: ContactPreferences = {
  contactGroupBy: "none",
  contactsView: "split",
  setContactGroupBy: vi.fn(),
  setContactsView: vi.fn(),
};

function populateTransientState(
  state: ReturnType<typeof useContactWorkspaceState>,
) {
  act(() => {
    state.startCreate();
    state.setDraft({ ...emptyDraft, display_name: "Private Draft" });
    state.setNoteText("Private note");
    state.setRelationshipTarget("private-party-id");
    state.setQuery("tenant-a@example.test");
    state.setContactGroupId("tenant-a-group");
    state.setStatusFilter("archived");
    state.setReviewFilter("ready");
    state.setTypeFilter("organization");
    state.setSourceFilter("csv_import");
    state.setQualityFilter("no_company");
    state.setContactPage(2);
    state.setContactPageSize(50);
    state.setContactSortBy("display_name");
    state.setContactSortDir("asc");
    state.setContactDetailPane("relationships");
    state.setRelationshipType("billing_contact");
  });
}
