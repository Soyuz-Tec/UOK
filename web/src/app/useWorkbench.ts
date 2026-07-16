import { useState } from "react";

import { useAuthState } from "./useAuthState";
import { useAuthWorkflows } from "./useAuthWorkflows";
import {
  useContactCommands,
  useContactWorkspaceState
} from "@uok-modules/contacts.core/web/src/moduleSurface";
import { useWorkbenchActions } from "./useWorkbenchActions";
import { useWorkbenchData } from "./useWorkbenchData";
import { useWorkbenchPreferences } from "./useWorkbenchPreferences";
import type { Section } from "../shared/types";
import { sectionFromSearch } from "./workbenchNavigation";

export function useWorkbench() {
  const [active, setActive] = useState<Section>(() => sectionFromSearch(window.location.search));
  const preferences = useWorkbenchPreferences();
  const auth = useAuthState();
  const {
    authMode,
    clearAuthState,
    currentUser,
    loginError,
    password,
    registerEmail,
    registerError,
    registerName,
    registerPassword,
    setAuthMode,
    setPassword,
    setRegisterEmail,
    setRegisterName,
    setRegisterPassword,
    setUsername,
    token,
    username
  } = auth;
  const contactsState = useContactWorkspaceState(preferences);
  const data = useWorkbenchData(token, contactsState.filters, clearAuthState);
  const authWorkflows = useAuthWorkflows(auth, data, contactsState.cancelEdit);
  const actions = useWorkbenchActions(data);
  const contactCommands = useContactCommands({
    command: actions.command,
    creating: contactsState.creating,
    data,
    draft: contactsState.draft,
    noteText: contactsState.noteText,
    relationshipTarget: contactsState.relationshipTarget,
    relationshipType: contactsState.relationshipType,
    setContactDetailPane: contactsState.setContactDetailPane,
    setCreating: contactsState.setCreating,
    setDraft: contactsState.setDraft,
    setEditing: contactsState.setEditing,
    setNoteText: contactsState.setNoteText,
    setRelationshipTarget: contactsState.setRelationshipTarget
  });

  function selectContact(id: string) {
    contactsState.clearSelectionState();
    data.setSelectedContactId(id);
  }

  return {
    active,
    setActive,
    appearance: preferences.appearance,
    setAppearance: preferences.setAppearance,
    locale: preferences.locale,
    setLocale: preferences.setLocale,
    contactGroupBy: preferences.contactGroupBy,
    setContactGroupBy: contactsState.setContactGroupBy,
    contactsView: preferences.contactsView,
    setContactsView: preferences.setContactsView,
    sidebarCollapsed: preferences.sidebarCollapsed,
    setSidebarCollapsed: preferences.setSidebarCollapsed,
    authMode,
    setAuthMode,
    username,
    setUsername,
    password,
    setPassword,
    registerName,
    setRegisterName,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    token,
    currentUser,
    loginError,
    registerError,
    out: data.out,
    dashboard: data.dashboard,
    contacts: data.contacts,
    contactGroups: data.contactGroups,
    contactGroupId: contactsState.contactGroupId,
    setContactGroupId: contactsState.setContactGroupId,
    selectedContactId: contactsState.creating ? "" : data.selectedContactId,
    setSelectedContactId: selectContact,
    selectedContact: contactsState.creating ? null : data.selectedContact,
    draft: contactsState.draft,
    setDraft: contactsState.setDraft,
    editing: contactsState.editing,
    setEditing: contactsState.setEditing,
    creating: contactsState.creating,
    contactDetailPane: contactsState.contactDetailPane,
    setContactDetailPane: contactsState.setContactDetailPane,
    query: contactsState.query,
    setQuery: contactsState.setQuery,
    statusFilter: contactsState.statusFilter,
    setStatusFilter: contactsState.setStatusFilter,
    reviewFilter: contactsState.reviewFilter,
    setReviewFilter: contactsState.setReviewFilter,
    typeFilter: contactsState.typeFilter,
    setTypeFilter: contactsState.setTypeFilter,
    sourceFilter: contactsState.sourceFilter,
    setSourceFilter: contactsState.setSourceFilter,
    qualityFilter: contactsState.qualityFilter,
    setQualityFilter: contactsState.setQualityFilter,
    contactPage: contactsState.contactPage,
    setContactPage: contactsState.setContactPage,
    contactPageSize: contactsState.contactPageSize,
    setContactPageSize: contactsState.setContactPageSize,
    contactSortBy: contactsState.contactSortBy,
    setContactSortBy: contactsState.setContactSortBy,
    contactSortDir: contactsState.contactSortDir,
    setContactSortDir: contactsState.setContactSortDir,
    contactHasNext: data.contactHasNext,
    contactTotalCount: data.contactTotalCount,
    clearContactFilters: contactsState.clearContactFilters,
    noteText: contactsState.noteText,
    setNoteText: contactsState.setNoteText,
    relationshipTarget: contactsState.relationshipTarget,
    setRelationshipTarget: contactsState.setRelationshipTarget,
    relationshipType: contactsState.relationshipType,
    setRelationshipType: contactsState.setRelationshipType,
    moduleRows: data.moduleRows,
    contactsModule: data.contactsModule,
    contactsOperational: data.contactsOperational,
    evidence: data.evidence,
    alignment: data.alignment,
    busyAction: data.busyAction,
    clearSession: authWorkflows.clearSession,
    refresh: data.refresh,
    login: authWorkflows.login,
    register: authWorkflows.register,
    moduleAction: actions.moduleAction,
    startCreate: contactsState.startCreate,
    startEdit: contactsState.startEdit,
    cancelEdit: contactsState.cancelEdit,
    updateSelectedContactField: contactCommands.updateSelectedContactField,
    saveDraft: contactCommands.saveDraft,
    archiveSelected: contactCommands.archiveSelected,
    restoreSelected: contactCommands.restoreSelected,
    purgeSelected: contactCommands.purgeSelected,
    markSelectedReady: contactCommands.markSelectedReady,
    addNote: contactCommands.addNote,
    addSelectedContactToGroup: contactCommands.addSelectedContactToGroup,
    removeSelectedContactFromGroup: contactCommands.removeSelectedContactFromGroup,
    linkRelationship: contactCommands.linkRelationship,
    updateRelationship: contactCommands.updateRelationship,
    removeRelationship: contactCommands.removeRelationship,
    mergeDuplicate: contactCommands.mergeDuplicate
  };
}

export type Workbench = ReturnType<typeof useWorkbench>;
