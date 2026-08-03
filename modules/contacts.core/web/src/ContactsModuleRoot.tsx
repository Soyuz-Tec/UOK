import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { ContactsWorkspace } from "./ContactsWorkspace";
import { CONTACTS_MODULE_ID } from "./contactModule";
import { useContactCommands } from "./app/useContactCommands";
import { useContactData } from "./app/useContactData";
import { useContactPreferences } from "./app/useContactPreferences";
import { useContactWorkspaceState } from "./app/useContactWorkspaceState";
import { contactMutationCapabilities } from "./app/contactMutationAuthority";
import { contactReadBoundary } from "./app/contactReadAuthority";

export function ContactsModuleRoot({ host }: { host: ModuleSurfaceRenderContext }) {
  const preferences = useContactPreferences();
  const state = useContactWorkspaceState(preferences, host.session);
  const module = host.moduleRows.find((row) => row.name === CONTACTS_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const readBoundary = contactReadBoundary(
    host.session.token,
    host.session.generation,
    host.currentUserRole,
    operational,
    host.surfaceActive,
  );
  const mutationCapabilities = contactMutationCapabilities(host.currentUserRole);
  const data = useContactData(host, operational, state.filters);
  const commands = useContactCommands({
    creating: state.creating,
    data,
    draft: state.draft,
    editing: state.editing,
    host,
    noteText: state.noteText,
    operational,
    relationshipTarget: state.relationshipTarget,
    relationshipType: state.relationshipType,
    setContactDetailPane: state.setContactDetailPane,
    setCreating: state.setCreating,
    setDraft: state.setDraft,
    setEditing: state.setEditing,
    setNoteText: state.setNoteText,
    setRelationshipTarget: state.setRelationshipTarget,
  });

  function selectContact(id: string) {
    state.clearSelectionState();
    data.setSelectedContactId(id);
  }

  async function refreshAll() {
    if (commands.reconciliationPending) {
      await commands.retryPendingReconciliation();
      return;
    }
    await Promise.all([data.refresh(), host.refreshHost()]);
  }

  return (
    <ContactsWorkspace
      token={host.session.token}
      contactReadBoundary={readBoundary}
      onUnauthorized={host.session.onUnauthorized}
      currentUserRole={host.currentUserRole}
      canManage={mutationCapabilities.canManage}
      operational={operational}
      module={module}
      contacts={data.contacts}
      contactGroups={data.contactGroups}
      selectedContact={state.creating ? null : data.selectedContact}
      selectedContactId={state.creating ? "" : data.selectedContactId}
      contactsView={preferences.contactsView}
      contactGroupBy={preferences.contactGroupBy}
      contactGroupId={state.contactGroupId}
      detailPane={state.contactDetailPane}
      query={state.query}
      statusFilter={state.statusFilter}
      reviewFilter={state.reviewFilter}
      typeFilter={state.typeFilter}
      sourceFilter={state.sourceFilter}
      qualityFilter={state.qualityFilter}
      contactPage={state.contactPage}
      contactPageSize={state.contactPageSize}
      contactHasNext={data.contactHasNext}
      contactTotalCount={data.contactTotalCount}
      contactSortBy={state.contactSortBy}
      contactSortDir={state.contactSortDir}
      draft={state.draft}
      editing={state.editing}
      noteText={state.noteText}
      relationshipTarget={state.relationshipTarget}
      relationshipType={state.relationshipType}
      activityRefreshGeneration={commands.productivityRefreshGeneration}
      busyAction={commands.busyAction || data.busyAction || host.busyAction}
      onActivate={() => void host.moduleAction(
        CONTACTS_MODULE_ID,
        module?.status === "disabled" ? "enable" : "install",
      )}
      onRefreshContacts={refreshAll}
      onViewChange={preferences.setContactsView}
      onContactGroupByChange={state.setContactGroupBy}
      onContactGroupChange={state.setContactGroupId}
      onDetailPaneChange={state.setContactDetailPane}
      onQueryChange={state.setQuery}
      onStatusFilterChange={state.setStatusFilter}
      onReviewFilterChange={state.setReviewFilter}
      onTypeFilterChange={state.setTypeFilter}
      onSourceFilterChange={state.setSourceFilter}
      onQualityFilterChange={state.setQualityFilter}
      onClearFilters={state.clearContactFilters}
      onContactPageChange={state.setContactPage}
      onContactPageSizeChange={state.setContactPageSize}
      onContactSortByChange={state.setContactSortBy}
      onContactSortDirChange={state.setContactSortDir}
      onSelect={selectContact}
      onCreate={state.startCreate}
      onAddSelectedContactToGroup={commands.addSelectedContactToGroup}
      onRemoveSelectedContactFromGroup={commands.removeSelectedContactFromGroup}
      onEdit={() => data.selectedContact && state.startEdit(data.selectedContact)}
      onInlineUpdate={commands.updateSelectedContactField}
      onDraftChange={state.setDraft}
      onSave={commands.saveDraft}
      onCancelEdit={state.cancelEdit}
      onArchive={commands.archiveSelected}
      onRestore={() => void commands.restoreSelected()}
      onPurge={commands.purgeSelected}
      onMarkReady={commands.markSelectedReady}
      onNoteTextChange={state.setNoteText}
      onAddNote={commands.addNote}
      onRelationshipTargetChange={state.setRelationshipTarget}
      onRelationshipTypeChange={state.setRelationshipType}
      onLinkRelationship={commands.linkRelationship}
      onUpdateRelationship={commands.updateRelationship}
      onRemoveRelationship={commands.removeRelationship}
      onMergeDuplicate={commands.mergeDuplicate}
    />
  );
}
