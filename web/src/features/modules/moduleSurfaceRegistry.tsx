import { CalendarDays, CalendarRange, ContactRound } from "lucide-react";
import type { ReactNode } from "react";

import type { Workbench } from "../../app/useWorkbench";
import type { Option } from "../../shared/options";
import type { Section } from "../../shared/types";
import { CalendarWorkspace } from "../calendar/CalendarWorkspace";
import { CALENDAR_MODULE_ID, CALENDAR_SECTION_ID } from "../calendar/calendarModule";
import { CONTACTS_MODULE_ID, CONTACTS_SECTION_ID } from "../contacts/contactModule";
import { ContactsWorkspace } from "../contacts/ContactsWorkspace";
import { PLANNING_MODULE_ID, PLANNING_SECTION_ID } from "../planning/planningModule";
import { PlanningWorkspace } from "../planning/PlanningWorkspace";

type ModuleSection = Extract<Section, "contacts" | "calendar" | "planning">;

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
        onNewGroupNameChange={workbench.setNewGroupName}
        onCreateGroup={workbench.createGroup}
        onGroupContactsByBusinessDomain={workbench.groupContactsByBusinessDomain}
        onGroupContactsBySmartRules={workbench.groupContactsBySmartRules}
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
        onMergeDuplicate={workbench.mergeDuplicate}
      />
    )
  },
  {
    id: CALENDAR_SECTION_ID,
    label: "Calendar",
    icon: CalendarDays,
    moduleName: CALENDAR_MODULE_ID,
    render: (workbench) => (
      <CalendarWorkspace
        token={workbench.token}
        moduleRows={workbench.moduleRows}
        busyAction={workbench.busyAction}
        onInstall={() => workbench.moduleAction(CALENDAR_MODULE_ID, "install")}
      />
    )
  },
  {
    id: PLANNING_SECTION_ID,
    label: "Planning",
    icon: CalendarRange,
    moduleName: PLANNING_MODULE_ID,
    render: (workbench) => {
      const planningModule = workbench.moduleRows.find((row) => row.name === PLANNING_MODULE_ID);
      return (
        <PlanningWorkspace
          token={workbench.token}
          appearance={workbench.appearance}
          module={planningModule}
          busyAction={workbench.busyAction}
          onActivate={() => workbench.moduleAction(PLANNING_MODULE_ID, planningModule?.status === "disabled" ? "enable" : "install")}
        />
      );
    }
  }
];

export const moduleSections: Array<Option<ModuleSection>> = moduleSurfaces.map(({ id, label, icon }) => ({ id, label, icon }));

export function renderModuleSurface(section: Section, workbench: Workbench): ReactNode {
  return moduleSurfaces.find((surface) => surface.id === section)?.render(workbench) ?? null;
}
