import { ContactRound } from "lucide-react";

import type { ModuleSurface } from "@uok/features/modules/moduleSurfaceContract";
import { CONTACTS_MODULE_ID, CONTACTS_SECTION_ID } from "./contactModule";
import { ContactsWorkspace } from "./ContactsWorkspace";
import "./styles/index.css";

export { CONTACTS_MODULE_ID };
export { useContactCommands } from "./app/useContactCommands";
export { useContactWorkspaceState } from "./app/useContactWorkspaceState";

export const contactsModuleSurface: ModuleSurface = {
  id: CONTACTS_SECTION_ID,
  label: "Contacts",
  icon: ContactRound,
  moduleName: CONTACTS_MODULE_ID,
  order: 30,
  render: (workbench) => (
    <ContactsWorkspace
      token={workbench.token}
      currentUserRole={workbench.currentUser?.role || ""}
      operational={workbench.contactsOperational}
      module={workbench.contactsModule}
      contacts={workbench.contacts}
      contactGroups={workbench.contactGroups}
      selectedContact={workbench.selectedContact}
      selectedContactId={workbench.selectedContactId}
      contactsView={workbench.contactsView}
      contactGroupBy={workbench.contactGroupBy}
      contactGroupId={workbench.contactGroupId}
      detailPane={workbench.contactDetailPane}
      query={workbench.query}
      statusFilter={workbench.statusFilter}
      reviewFilter={workbench.reviewFilter}
      typeFilter={workbench.typeFilter}
      sourceFilter={workbench.sourceFilter}
      qualityFilter={workbench.qualityFilter}
      contactPage={workbench.contactPage}
      contactPageSize={workbench.contactPageSize}
      contactHasNext={workbench.contactHasNext}
      contactTotalCount={workbench.contactTotalCount}
      contactSortBy={workbench.contactSortBy}
      contactSortDir={workbench.contactSortDir}
      draft={workbench.draft}
      editing={workbench.editing}
      noteText={workbench.noteText}
      relationshipTarget={workbench.relationshipTarget}
      relationshipType={workbench.relationshipType}
      busyAction={workbench.busyAction}
      onActivate={() => workbench.moduleAction(CONTACTS_MODULE_ID, workbench.contactsModule?.status === "disabled" ? "enable" : "install")}
      onRefreshContacts={workbench.refresh}
      onViewChange={workbench.setContactsView}
      onContactGroupByChange={workbench.setContactGroupBy}
      onContactGroupChange={workbench.setContactGroupId}
      onDetailPaneChange={workbench.setContactDetailPane}
      onQueryChange={workbench.setQuery}
      onStatusFilterChange={workbench.setStatusFilter}
      onReviewFilterChange={workbench.setReviewFilter}
      onTypeFilterChange={workbench.setTypeFilter}
      onSourceFilterChange={workbench.setSourceFilter}
      onQualityFilterChange={workbench.setQualityFilter}
      onClearFilters={workbench.clearContactFilters}
      onContactPageChange={workbench.setContactPage}
      onContactPageSizeChange={workbench.setContactPageSize}
      onContactSortByChange={workbench.setContactSortBy}
      onContactSortDirChange={workbench.setContactSortDir}
      onSelect={workbench.setSelectedContactId}
      onCreate={workbench.startCreate}
      onAddSelectedContactToGroup={workbench.addSelectedContactToGroup}
      onRemoveSelectedContactFromGroup={workbench.removeSelectedContactFromGroup}
      onEdit={() => workbench.selectedContact && workbench.startEdit(workbench.selectedContact)}
      onInlineUpdate={workbench.updateSelectedContactField}
      onDraftChange={workbench.setDraft}
      onSave={workbench.saveDraft}
      onCancelEdit={workbench.cancelEdit}
      onArchive={workbench.archiveSelected}
      onRestore={workbench.restoreSelected}
      onPurge={workbench.purgeSelected}
      onMarkReady={workbench.markSelectedReady}
      onNoteTextChange={workbench.setNoteText}
      onAddNote={workbench.addNote}
      onRelationshipTargetChange={workbench.setRelationshipTarget}
      onRelationshipTypeChange={workbench.setRelationshipType}
      onLinkRelationship={workbench.linkRelationship}
      onUpdateRelationship={workbench.updateRelationship}
      onRemoveRelationship={workbench.removeRelationship}
      onMergeDuplicate={workbench.mergeDuplicate}
    />
  )
};

export default contactsModuleSurface;
