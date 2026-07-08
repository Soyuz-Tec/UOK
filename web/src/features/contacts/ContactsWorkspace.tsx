import { useEffect, useState } from "react";
import { Download, Power } from "lucide-react";

import { EmptyState, StatusPill } from "../../shared/data-display";
import { Pane, WorkflowSplitView } from "../../shared/layout";
import { WorkspaceEditorPopup } from "../../shared/overlays";
import { CommandButton } from "../../shared/primitives";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { ContactGroupsPanel } from "./ContactGroupsPanel";
import { ContactQualityWorkspace } from "./ContactQualityWorkspace";
import { ContactResultsPanel } from "./ContactResultsPanel";
import { ContactsToolbar } from "./ContactsToolbar";
import type { ContactsWorkspaceProps } from "./types";

export function ContactsWorkspace(props: ContactsWorkspaceProps) {
  const popupMode = props.contactsView === "table" || props.contactsView === "cards" || props.contactsView === "quality";
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);

  useEffect(() => {
    if (!popupMode) setDetailPopupOpen(false);
  }, [popupMode]);

  useEffect(() => {
    if (!props.selectedContact && !props.editing) setDetailPopupOpen(false);
  }, [props.editing, props.selectedContact]);

  const selectContact = (id: string) => {
    props.onSelect(id);
    if (popupMode) setDetailPopupOpen(true);
  };

  const createContact = () => {
    props.onCreate();
    if (popupMode) setDetailPopupOpen(true);
  };

  const changeView = (value: ContactsWorkspaceProps["contactsView"]) => {
    setDetailPopupOpen(false);
    props.onViewChange(value);
  };

  const closeDetailPopup = () => {
    if (props.editing) props.onCancelEdit();
    setDetailPopupOpen(false);
  };

  if (!props.token) {
    return (
      <section className="contacts-workspace" aria-label="Contacts">
        <EmptyState text="Sign in to open Contacts." />
      </section>
    );
  }

  if (!props.operational) {
    const moduleStatus = props.module?.status || "available";
    const activationLabel = moduleStatus === "disabled" ? "Enable" : "Install";
    const ActivationIcon = moduleStatus === "disabled" ? Power : Download;
    const activationAction = moduleStatus === "disabled" ? "enable" : "install";

    return (
      <section className="contacts-workspace" aria-label="Contacts">
        <Pane title="Contacts" description="Module state" wide>
          <div className="module-row">
            <div className="module-main">
              <div className="module-title-line">
                <h2 className="module-name">contacts.core</h2>
                <StatusPill label={props.module?.status || "available"} tone="info" />
              </div>
              <p className="module-meta">capability_module - {props.module?.version || "not loaded"}</p>
            </div>
            <div className="module-actions">
              <CommandButton icon={ActivationIcon} onClick={props.onActivate} loading={props.busyAction === `contacts.core:${activationAction}`}>{activationLabel}</CommandButton>
            </div>
          </div>
        </Pane>
      </section>
    );
  }

  return (
    <section className={`contacts-workspace contacts-view-${props.contactsView}`} aria-label="Contacts">
      <ContactsToolbar
        query={props.query}
        statusFilter={props.statusFilter}
        reviewFilter={props.reviewFilter}
        typeFilter={props.typeFilter}
        sourceFilter={props.sourceFilter}
        qualityFilter={props.qualityFilter}
        contactGroups={props.contactGroups}
        contactGroupId={props.contactGroupId}
        contactPage={props.contactPage}
        contactPageSize={props.contactPageSize}
        contactHasNext={props.contactHasNext}
        contactTotalCount={props.contactTotalCount}
        visibleCount={props.contacts.length}
        contactSortBy={props.contactSortBy}
        contactSortDir={props.contactSortDir}
        contactsView={props.contactsView}
        contactGroupBy={props.contactGroupBy}
        onQueryChange={props.onQueryChange}
        onStatusFilterChange={props.onStatusFilterChange}
        onReviewFilterChange={props.onReviewFilterChange}
        onTypeFilterChange={props.onTypeFilterChange}
        onSourceFilterChange={props.onSourceFilterChange}
        onQualityFilterChange={props.onQualityFilterChange}
        onContactGroupChange={props.onContactGroupChange}
        onContactGroupByChange={props.onContactGroupByChange}
        onClearFilters={props.onClearFilters}
        onContactPageChange={props.onContactPageChange}
        onContactPageSizeChange={props.onContactPageSizeChange}
        onContactSortByChange={props.onContactSortByChange}
        onContactSortDirChange={props.onContactSortDirChange}
        onViewChange={changeView}
        onCreate={createContact}
      />
      <div className="contacts-workspace-body">
        <ContactGroupsPanel
          groups={props.contactGroups}
          selectedGroupId={props.contactGroupId}
          newGroupName={props.newGroupName}
          onGroupChange={props.onContactGroupChange}
          onNewGroupNameChange={props.onNewGroupNameChange}
          onCreateGroup={props.onCreateGroup}
          onGroupContactsByBusinessDomain={props.onGroupContactsByBusinessDomain}
          onGroupContactsBySmartRules={props.onGroupContactsBySmartRules}
          onArchiveGroup={props.onArchiveGroup}
          domainGroupingBusy={props.busyAction === "GroupContactsByBusinessEmailDomain"}
          smartGroupingBusy={props.busyAction === "GroupContactsBySmartRule"}
        />
        <div className="contacts-workspace-main">
          {props.contactsView === "quality" ? (
            <ContactQualityWorkspace {...props} onOpenEditor={() => setDetailPopupOpen(true)} />
          ) : props.contactsView === "split" ? (
            <WorkflowSplitView
              primaryLabel="Contact results"
              secondaryLabel="Contact inspector"
              primary={<ContactResultsPanel contacts={props.contacts} contactsView={props.contactsView} selectedContactId={props.selectedContactId} contactGroupBy={props.contactGroupBy} onSelect={props.onSelect} />}
              secondary={<ContactDetailPanel {...props} />}
            />
          ) : (
            <section className="contacts-results-workspace" aria-label="Contact results">
              <ContactResultsPanel contacts={props.contacts} contactsView={props.contactsView} selectedContactId={props.selectedContactId} contactGroupBy={props.contactGroupBy} onSelect={selectContact} />
            </section>
          )}
        </div>
      </div>
      <WorkspaceEditorPopup
        open={popupMode && detailPopupOpen && Boolean(props.selectedContact || props.editing)}
        label={props.editing ? "Create or edit contact" : "Contact details"}
        title={props.editing ? "Contact editor" : "Contact workspace"}
        description={props.editing ? "Add only the details you have now. More sections can be added when needed." : "Review and update contact details without leaving the workspace."}
        onClose={closeDetailPopup}
        size="wide"
        chrome="minimal"
        className="contacts-detail-popup"
      >
        <ContactDetailPanel {...props} onCreate={createContact} />
      </WorkspaceEditorPopup>
    </section>
  );
}
