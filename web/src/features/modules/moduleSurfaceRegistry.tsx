import { ContactRound } from "lucide-react";
import type { ReactNode } from "react";

import type { Workbench } from "../../app/useWorkbench";
import type { Option } from "../../shared/options";
import type { Section } from "../../shared/types";
import { CONTACTS_MODULE_ID, CONTACTS_SECTION_ID } from "../contacts/contactModule";
import { ContactsWorkspace } from "../contacts/ContactsWorkspace";

type ModuleSection = Extract<Section, "contacts">;

type ModuleSurface = Option<ModuleSection> & {
  moduleName: string;
  render: (workbench: Workbench) => ReactNode;
};

export const moduleSurfaces: ModuleSurface[] = [
  {
    id: CONTACTS_SECTION_ID,
    label: "Contacts",
    icon: ContactRound,
    moduleName: CONTACTS_MODULE_ID,
    render: (workbench) => (
      <ContactsWorkspace
        token={workbench.token}
        operational={workbench.contactsOperational}
        module={workbench.contactsModule}
        contacts={workbench.contacts}
        contactGroups={workbench.contactGroups}
        selectedContact={workbench.selectedContact}
        selectedContactId={workbench.selectedContactId}
        contactsView={workbench.contactsView}
        contactGroupBy={workbench.contactGroupBy}
        contactGroupId={workbench.contactGroupId}
        newGroupName={workbench.newGroupName}
        detailPane={workbench.contactDetailPane}
        query={workbench.query}
        statusFilter={workbench.statusFilter}
        reviewFilter={workbench.reviewFilter}
        typeFilter={workbench.typeFilter}
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
        onViewChange={workbench.setContactsView}
        onContactGroupByChange={workbench.setContactGroupBy}
        onContactGroupChange={workbench.setContactGroupId}
        onDetailPaneChange={workbench.setContactDetailPane}
        onQueryChange={workbench.setQuery}
        onStatusFilterChange={workbench.setStatusFilter}
        onReviewFilterChange={workbench.setReviewFilter}
        onTypeFilterChange={workbench.setTypeFilter}
        onClearFilters={workbench.clearContactFilters}
        onContactPageChange={workbench.setContactPage}
        onContactPageSizeChange={workbench.setContactPageSize}
        onContactSortByChange={workbench.setContactSortBy}
        onContactSortDirChange={workbench.setContactSortDir}
        onSelect={workbench.setSelectedContactId}
        onCreate={workbench.startCreate}
        onNewGroupNameChange={workbench.setNewGroupName}
        onCreateGroup={workbench.createGroup}
        onGroupContactsByBusinessDomain={workbench.groupContactsByBusinessDomain}
        onArchiveGroup={workbench.archiveGroup}
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
      />
    )
  }
];

export const moduleSections: Array<Option<ModuleSection>> = moduleSurfaces.map(({ id, label, icon }) => ({ id, label, icon }));

export function renderModuleSurface(section: Section, workbench: Workbench): ReactNode {
  return moduleSurfaces.find((surface) => surface.id === section)?.render(workbench) ?? null;
}
