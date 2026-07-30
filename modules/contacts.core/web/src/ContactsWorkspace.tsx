import { useCallback, useEffect, useState } from "react";
import { Download, Power } from "lucide-react";

import { EmptyState, StatusPill } from "@uok/shared/data-display";
import { Pane, WorkflowSplitView } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { CommandButton } from "@uok/shared/primitives";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { ContactDataToolsManager } from "./ContactDataToolsManager";
import { ContactGroupsManager } from "./ContactGroupsManager";
import { ContactQualityWorkspace } from "./ContactQualityWorkspace";
import { ContactResultsPanel } from "./ContactResultsPanel";
import { ContactsToolbar } from "./ContactsToolbar";
import type { ContactsWorkspaceProps } from "./types";
import { useCompactContactsWorkspace } from "./useCompactContactsWorkspace";
import { useContactFieldVisibility } from "./useContactFieldVisibility";

export function ContactsWorkspace(props: ContactsWorkspaceProps) {
  const compactWorkspace = useCompactContactsWorkspace();
  const popupMode = props.contactsView === "table"
    || props.contactsView === "cards"
    || props.contactsView === "quality"
    || (props.contactsView === "split" && compactWorkspace);
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);
  const [groupsManagerOpen, setGroupsManagerOpen] = useState(false);
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const canManageGroups = props.currentUserRole === "platform_admin" || props.currentUserRole === "ops_manager";

  useEffect(() => {
    if (!popupMode) setDetailPopupOpen(false);
  }, [popupMode]);

  useEffect(() => {
    if (!props.selectedContact && !props.editing) setDetailPopupOpen(false);
  }, [props.editing, props.selectedContact]);

  useEffect(() => {
    if (!props.token || !props.operational) {
      setGroupsManagerOpen(false);
      setDataToolsOpen(false);
    }
  }, [props.operational, props.token]);

  const selectContact = useCallback((id: string) => {
    props.onSelect(id);
    if (popupMode) setDetailPopupOpen(true);
  }, [popupMode, props.onSelect]);

  const createContact = useCallback(() => {
    props.onCreate();
    if (popupMode) setDetailPopupOpen(true);
  }, [popupMode, props.onCreate]);

  const changeView = (value: ContactsWorkspaceProps["contactsView"]) => {
    setDetailPopupOpen(false);
    props.onViewChange(value);
  };

  const closeDetailPopup = () => {
    if (props.editing) props.onCancelEdit();
    setDetailPopupOpen(false);
  };
  const { fieldVisibility, listDisplayVisibility, tableVisibleColumns } = useContactFieldVisibility(
    props.contactsView,
    selectContact
  );

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
        token={props.token}
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
        fieldVisibility={fieldVisibility}
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
        onOpenGroupsManager={() => setGroupsManagerOpen(true)}
        onOpenDataToolsManager={() => setDataToolsOpen(true)}
        currentUserRole={props.currentUserRole}
      />
      <div className="contacts-workspace-body">
        <div className="contacts-workspace-main">
          {props.contactsView === "quality" ? (
            <ContactQualityWorkspace {...props} onOpenEditor={() => setDetailPopupOpen(true)} />
          ) : props.contactsView === "split" && !compactWorkspace ? (
            <WorkflowSplitView
              primaryLabel="Contact results"
              secondaryLabel="Contact inspector"
              primary={<ContactResultsPanel contacts={props.contacts} contactsView={props.contactsView} selectedContactId={props.selectedContactId} contactGroupBy={props.contactGroupBy} listDisplayVisibility={listDisplayVisibility} tableVisibleColumns={tableVisibleColumns} onSelect={props.onSelect} />}
              secondary={<ContactDetailPanel {...props} />}
            />
          ) : (
            <section className="contacts-results-workspace" aria-label="Contact results">
              <ContactResultsPanel contacts={props.contacts} contactsView={props.contactsView} selectedContactId={props.selectedContactId} contactGroupBy={props.contactGroupBy} listDisplayVisibility={listDisplayVisibility} tableVisibleColumns={tableVisibleColumns} onSelect={selectContact} />
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
      <ContactGroupsManager
        open={groupsManagerOpen}
        token={props.token}
        canManage={canManageGroups}
        onClose={() => setGroupsManagerOpen(false)}
        onChanged={props.onRefreshContacts}
        onGroupArchived={(groupId) => {
          if (props.contactGroupId === groupId) props.onContactGroupChange("");
        }}
      />
      <ContactDataToolsManager
        open={dataToolsOpen}
        token={props.token}
        currentUserRole={props.currentUserRole}
        contacts={props.contacts}
        groups={props.contactGroups}
        selectedContact={props.selectedContact}
        onClose={() => setDataToolsOpen(false)}
        onChanged={props.onRefreshContacts}
      />
    </section>
  );
}
