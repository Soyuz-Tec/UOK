import { CalendarDays, ContactRound } from "lucide-react";
import type { ReactNode } from "react";

import type { Workbench } from "../../app/useWorkbench";
import type { Option } from "../../shared/options";
import type { Section } from "../../shared/types";
import { CalendarWorkspace } from "../calendar/CalendarWorkspace";
import { CALENDAR_MODULE_ID, CALENDAR_SECTION_ID } from "../calendar/calendarModule";
import { CONTACTS_MODULE_ID, CONTACTS_SECTION_ID } from "../contacts/contactModule";
import { ContactsWorkspace } from "../contacts/ContactsWorkspace";

type ModuleSection = Extract<Section, "contacts" | "calendar">;

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
        reviewRows={workbench.reviewRows}
        selectedContact={workbench.selectedContact}
        selectedContactId={workbench.selectedContactId}
        contactsView={workbench.contactsView}
        detailPane={workbench.contactDetailPane}
        query={workbench.query}
        statusFilter={workbench.statusFilter}
        reviewFilter={workbench.reviewFilter}
        typeFilter={workbench.typeFilter}
        draft={workbench.draft}
        editing={workbench.editing}
        noteText={workbench.noteText}
        relationshipTarget={workbench.relationshipTarget}
        relationshipType={workbench.relationshipType}
        importFilename={workbench.importFilename}
        importText={workbench.importText}
        importBatches={workbench.importBatches}
        busyAction={workbench.busyAction}
        onInstall={() => workbench.moduleAction(CONTACTS_MODULE_ID, "install")}
        onViewChange={workbench.setContactsView}
        onDetailPaneChange={workbench.setContactDetailPane}
        onQueryChange={workbench.setQuery}
        onStatusFilterChange={workbench.setStatusFilter}
        onReviewFilterChange={workbench.setReviewFilter}
        onTypeFilterChange={workbench.setTypeFilter}
        onSelect={workbench.setSelectedContactId}
        onCreate={workbench.startCreate}
        onEdit={() => workbench.selectedContact && workbench.startEdit(workbench.selectedContact)}
        onDraftChange={workbench.setDraft}
        onSave={workbench.saveDraft}
        onCancelEdit={() => workbench.setEditing(false)}
        onArchive={workbench.archiveSelected}
        onRestore={workbench.restoreSelected}
        onPurge={workbench.purgeSelected}
        onNoteTextChange={workbench.setNoteText}
        onAddNote={workbench.addNote}
        onRelationshipTargetChange={workbench.setRelationshipTarget}
        onRelationshipTypeChange={workbench.setRelationshipType}
        onLinkRelationship={workbench.linkRelationship}
        onImportFilenameChange={workbench.setImportFilename}
        onImportTextChange={workbench.setImportText}
        onImport={workbench.importCsv}
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
  }
];

export const moduleSections: Array<Option<ModuleSection>> = moduleSurfaces.map(({ id, label, icon }) => ({ id, label, icon }));

export function renderModuleSurface(section: Section, workbench: Workbench): ReactNode {
  return moduleSurfaces.find((surface) => surface.id === section)?.render(workbench) ?? null;
}
