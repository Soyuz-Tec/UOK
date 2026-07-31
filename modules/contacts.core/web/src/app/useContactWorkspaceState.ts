import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { draftFromContact } from "./contactDraft";
import type { ContactPreferences } from "./useContactPreferences";
import type { ContactDetailPane, ContactDraft, ContactQualityFilter, ContactRecord, ContactSortBy, ContactSortDir, ContactSourceFilter } from "../contracts";
import { emptyDraft } from "../contracts";

type ContactWorkspaceOwner = {
  token: string;
  generation: number;
};

export function useContactWorkspaceState(
  preferences: ContactPreferences,
  owner: ContactWorkspaceOwner,
) {
  const previousOwner = useRef({
    token: owner.token,
    generation: owner.generation,
  });
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [contactDetailPane, setContactDetailPane] = useState<ContactDetailPane>("overview");
  const [query, setQuery] = useState("");
  const [contactGroupId, setContactGroupId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<ContactSourceFilter>("all");
  const [qualityFilter, setQualityFilter] = useState<ContactQualityFilter>("all");
  const [contactPage, setContactPage] = useState(0);
  const [contactPageSize, setContactPageSize] = useState(25);
  const [contactSortBy, setContactSortBy] = useState<ContactSortBy>("updated_at");
  const [contactSortDir, setContactSortDir] = useState<ContactSortDir>("desc");
  const [noteText, setNoteText] = useState("");
  const [relationshipTarget, setRelationshipTarget] = useState("");
  const [relationshipType, setRelationshipType] = useState("primary_contact");
  const ownerChanged = previousOwner.current.token !== owner.token
    || previousOwner.current.generation !== owner.generation;

  useLayoutEffect(() => {
    if (previousOwner.current.token === owner.token
      && previousOwner.current.generation === owner.generation) return;
    previousOwner.current = {
      token: owner.token,
      generation: owner.generation,
    };
    setCreating(false);
    setEditing(false);
    setDraft(emptyDraft);
    setNoteText("");
    setRelationshipTarget("");
    setQuery("");
    setContactGroupId("");
    setStatusFilter("active");
    setReviewFilter("all");
    setTypeFilter("all");
    setSourceFilter("all");
    setQualityFilter("all");
    setContactPage(0);
    setContactPageSize(25);
    setContactSortBy("updated_at");
    setContactSortDir("desc");
    setContactDetailPane("overview");
    setRelationshipType("primary_contact");
  }, [owner.generation, owner.token]);

  const filters = useMemo(() => ownerChanged ? ({
    query: "",
    contactGroupId: "",
    statusFilter: "active",
    reviewFilter: "all",
    typeFilter: "all",
    sourceFilter: "all" as const,
    qualityFilter: "all" as const,
    contactPage: 0,
    contactPageSize: 25,
    contactSortBy: "updated_at" as const,
    contactSortDir: "desc" as const,
  }) : ({
    query,
    contactGroupId,
    statusFilter,
    reviewFilter,
    typeFilter,
    sourceFilter,
    qualityFilter,
    contactPage,
    contactPageSize,
    contactSortBy,
    contactSortDir,
  }), [
    contactGroupId,
    contactPage,
    contactPageSize,
    contactSortBy,
    contactSortDir,
    ownerChanged,
    qualityFilter,
    query,
    reviewFilter,
    sourceFilter,
    statusFilter,
    typeFilter,
  ]);

  function startCreate() {
    setCreating(true);
    setDraft(emptyDraft);
    setNoteText("");
    setRelationshipTarget("");
    setContactDetailPane("overview");
    setEditing(true);
  }

  function startEdit(contact: ContactRecord) {
    setCreating(false);
    setDraft(draftFromContact(contact));
    setContactDetailPane("overview");
    setEditing(true);
  }

  function clearSelectionState() {
    setCreating(false);
    setEditing(false);
    setDraft(emptyDraft);
  }

  function changeContactGroupBy(value: typeof preferences.contactGroupBy) {
    setContactPage(0);
    preferences.setContactGroupBy(value);
  }

  function changeQuery(value: string) {
    setContactPage(0);
    setQuery(value);
  }

  function changeContactGroupId(value: string) {
    setContactPage(0);
    setContactGroupId(value);
  }

  function changeStatusFilter(value: string) {
    setContactPage(0);
    setStatusFilter(value);
  }

  function changeReviewFilter(value: string) {
    setContactPage(0);
    setReviewFilter(value);
  }

  function changeTypeFilter(value: string) {
    setContactPage(0);
    setTypeFilter(value);
  }

  function changeSourceFilter(value: ContactSourceFilter) {
    setContactPage(0);
    setSourceFilter(value);
  }

  function changeQualityFilter(value: ContactQualityFilter) {
    setContactPage(0);
    setQualityFilter(value);
  }

  function changeContactPageSize(value: number) {
    setContactPage(0);
    setContactPageSize(value);
  }

  function changeContactSortBy(value: ContactSortBy) {
    setContactPage(0);
    setContactSortBy(value);
  }

  function changeContactSortDir(value: ContactSortDir) {
    setContactPage(0);
    setContactSortDir(value);
  }

  function clearContactFilters() {
    setQuery("");
    setContactGroupId("");
    setStatusFilter("active");
    setReviewFilter("all");
    setTypeFilter("all");
    setSourceFilter("all");
    setQualityFilter("all");
    setContactSortBy("updated_at");
    setContactSortDir("desc");
    setContactPage(0);
    preferences.setContactGroupBy("none");
  }

  function cancelEdit() {
    setCreating(false);
    setEditing(false);
    setDraft(emptyDraft);
  }

  return {
    cancelEdit,
    clearContactFilters,
    clearSelectionState,
    contactDetailPane,
    contactGroupId,
    contactPage,
    contactPageSize,
    contactSortBy,
    contactSortDir,
    creating,
    draft,
    editing,
    filters,
    noteText,
    query,
    relationshipTarget,
    relationshipType,
    reviewFilter,
    sourceFilter,
    qualityFilter,
    setContactDetailPane,
    setContactPage,
    setCreating,
    setDraft,
    setEditing,
    setNoteText,
    setRelationshipTarget,
    setRelationshipType,
    setReviewFilter: changeReviewFilter,
    setStatusFilter: changeStatusFilter,
    setTypeFilter: changeTypeFilter,
    setSourceFilter: changeSourceFilter,
    setQualityFilter: changeQualityFilter,
    setQuery: changeQuery,
    setContactGroupId: changeContactGroupId,
    setContactPageSize: changeContactPageSize,
    setContactSortBy: changeContactSortBy,
    setContactSortDir: changeContactSortDir,
    startCreate,
    startEdit,
    statusFilter,
    typeFilter,
    setContactGroupBy: changeContactGroupBy
  };
}

export type ContactWorkspaceState = ReturnType<typeof useContactWorkspaceState>;
