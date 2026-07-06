import { useMemo, useState } from "react";

import { draftFromContact, nonEmptyDraftPayload } from "./contactDraft";
import { useAuthState } from "./useAuthState";
import { useAuthWorkflows } from "./useAuthWorkflows";
import { useWorkbenchActions } from "./useWorkbenchActions";
import { useWorkbenchData } from "./useWorkbenchData";
import { useWorkbenchPreferences } from "./useWorkbenchPreferences";
import type { ContactDetailPane, ContactDraft, ContactRecord, Section } from "../shared/types";
import { emptyDraft } from "../shared/types";

export function useWorkbench() {
  const [active, setActive] = useState<Section>("apps");
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
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [contactDetailPane, setContactDetailPane] = useState<ContactDetailPane>("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [noteText, setNoteText] = useState("");
  const [relationshipTarget, setRelationshipTarget] = useState("");
  const [relationshipType, setRelationshipType] = useState("primary_contact");
  const [importFilename, setImportFilename] = useState("contacts.csv");
  const [importText, setImportText] = useState("display_name,email,company,phone\n");

  const filters = useMemo(() => ({ query, statusFilter, reviewFilter, typeFilter }), [query, reviewFilter, statusFilter, typeFilter]);
  const data = useWorkbenchData(token, filters, clearAuthState);
  const authWorkflows = useAuthWorkflows(auth, data, () => setEditing(false));
  const actions = useWorkbenchActions(data);
  const { command } = actions;

  function startCreate() {
    setDraft(emptyDraft);
    data.setSelectedContactId("");
    setContactDetailPane("overview");
    setEditing(true);
  }

  function startEdit(contact: ContactRecord) {
    setDraft(draftFromContact(contact));
    setContactDetailPane("overview");
    setEditing(true);
  }

  async function saveDraft() {
    const payload = nonEmptyDraftPayload(draft);
    const result = data.selectedContactId
      ? await command("UpdateContact", { ...payload, party_id: data.selectedContactId }, "contact-update")
      : await command("CreateContact", payload, "contact-create");
    const resultId = result?.result?.id || result?.result?.contact_id;
    if (resultId) data.setSelectedContactId(resultId);
    setContactDetailPane("overview");
    setEditing(false);
    setDraft(emptyDraft);
  }

  async function archiveSelected() {
    if (data.selectedContactId) await command("ArchiveContact", { party_id: data.selectedContactId }, "contact-archive");
  }

  async function restoreSelected() {
    if (data.selectedContactId) await command("RestoreContact", { party_id: data.selectedContactId }, "contact-restore");
  }

  async function purgeSelected() {
    if (data.selectedContactId) await command("PurgeContact", { party_id: data.selectedContactId }, "contact-purge");
  }

  async function addNote() {
    if (!data.selectedContactId || !noteText.trim()) return;
    await command("AddContactNote", { party_id: data.selectedContactId, body: noteText }, "contact-note");
    setNoteText("");
    await data.loadContactDetail(data.selectedContactId);
  }

  async function linkRelationship() {
    if (!data.selectedContactId || !relationshipTarget) return;
    await command("LinkContactRelationship", {
      from_party_id: data.selectedContactId,
      to_party_id: relationshipTarget,
      relationship_type: relationshipType
    }, "contact-relationship");
    setRelationshipTarget("");
    await data.loadContactDetail(data.selectedContactId);
  }

  return {
    active,
    setActive,
    appearance: preferences.appearance,
    setAppearance: preferences.setAppearance,
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
    reviewRows: data.reviewRows,
    importBatches: data.importBatches,
    selectedContactId: data.selectedContactId,
    setSelectedContactId: data.setSelectedContactId,
    selectedContact: data.selectedContact,
    draft,
    setDraft,
    editing,
    setEditing,
    contactDetailPane,
    setContactDetailPane,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    reviewFilter,
    setReviewFilter,
    typeFilter,
    setTypeFilter,
    noteText,
    setNoteText,
    relationshipTarget,
    setRelationshipTarget,
    relationshipType,
    setRelationshipType,
    importFilename,
    setImportFilename,
    importText,
    setImportText,
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
    startCreate,
    startEdit,
    saveDraft,
    archiveSelected,
    restoreSelected,
    purgeSelected,
    addNote,
    linkRelationship,
    importCsv: () => actions.importCsv(importFilename, importText)
  };
}

export type Workbench = ReturnType<typeof useWorkbench>;
