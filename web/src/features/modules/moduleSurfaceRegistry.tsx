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
  }
];

export const moduleSections: Array<Option<ModuleSection>> = moduleSurfaces.map(({ id, label, icon }) => ({ id, label, icon }));

export function renderModuleSurface(section: Section, workbench: Workbench): ReactNode {
  return moduleSurfaces.find((surface) => surface.id === section)?.render(workbench) ?? null;
}
