import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useWorkbench } from "./app/useWorkbench";
import { AppsManagerPanel } from "./features/apps/AppsManagerPanel";
import { AuthScreen } from "./features/auth/AuthScreen";
import { ContactsWorkspace } from "./features/contacts/ContactsWorkspace";
import { AccountMenu } from "./features/layout/AccountMenu";
import { sections } from "./shared/options";
import { JsonBlock, MetricGrid, Pane, StatusRow } from "./shared/ui";

export function App() {
  const workbench = useWorkbench();

  if (!workbench.token) {
    return (
      <AuthScreen
        mode={workbench.authMode}
        username={workbench.username}
        password={workbench.password}
        registerName={workbench.registerName}
        registerEmail={workbench.registerEmail}
        registerPassword={workbench.registerPassword}
        loginError={workbench.loginError}
        registerError={workbench.registerError}
        busyAction={workbench.busyAction}
        onModeChange={workbench.setAuthMode}
        onUsernameChange={workbench.setUsername}
        onPasswordChange={workbench.setPassword}
        onRegisterNameChange={workbench.setRegisterName}
        onRegisterEmailChange={workbench.setRegisterEmail}
        onRegisterPasswordChange={workbench.setRegisterPassword}
        onLogin={workbench.login}
        onRegister={workbench.register}
      />
    );
  }

  const SidebarToggleIcon = workbench.sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const sidebarToggleLabel = workbench.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <div className={workbench.sidebarCollapsed ? "shell sidebar-collapsed" : "shell"}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-top">
          <button type="button" className="brand" aria-label="Home" title="Home" onClick={() => workbench.setActive("overview")}>
            <span className="brand-mark" aria-hidden="true">K</span>
            <span className="brand-label">
              <strong>UOK</strong>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarToggleLabel}
            aria-pressed={workbench.sidebarCollapsed}
            title={sidebarToggleLabel}
            onClick={() => workbench.setSidebarCollapsed((value) => !value)}
          >
            <SidebarToggleIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <nav className="nav-list">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                className={workbench.active === section.id ? "nav-item active" : "nav-item"}
                aria-label={section.label}
                aria-current={workbench.active === section.id ? "page" : undefined}
                title={workbench.sidebarCollapsed ? section.label : undefined}
                onClick={() => workbench.setActive(section.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="nav-label">{section.label}</span>
              </button>
            );
          })}
        </nav>
        <AccountMenu
          user={workbench.currentUser}
          appearance={workbench.appearance}
          busy={workbench.busyAction === "refresh"}
          onAppearanceChange={workbench.setAppearance}
          onRefresh={() => workbench.refresh()}
          onSignOut={() => workbench.clearSession()}
        />
      </aside>

      <main className="workbench">
        {workbench.active === "overview" && (
          <section className="content-grid" aria-label="Overview">
            <Pane title="Readiness" description="Release gates">
              <StatusRow label="Baseline readiness" ok={Boolean(workbench.alignment?.ok)} />
              <StatusRow label="Module-neutral core" ok={Boolean(workbench.alignment?.checks?.module_neutral_baseline)} />
              <StatusRow label="Baseline evidence" ok={Boolean(workbench.evidence?.ok)} />
            </Pane>
            <Pane title="Counts" description="Current organization">
              <MetricGrid counts={workbench.dashboard?.counts || {}} />
            </Pane>
          </section>
        )}

        {workbench.active === "apps" && (
          <AppsManagerPanel modules={workbench.moduleRows} busyAction={workbench.busyAction} onAction={workbench.moduleAction} />
        )}

        {workbench.active === "contacts" && (
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
            onInstall={() => workbench.moduleAction("contacts.core", "install")}
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
        )}

        {workbench.active === "evidence" && (
          <section aria-label="Evidence">
            <Pane title="Evidence" description="Baseline verification" wide>
              <JsonBlock value={workbench.evidence} />
            </Pane>
          </section>
        )}

        {workbench.active === "architecture" && (
          <section aria-label="Architecture">
            <Pane title="Architecture" description="Architecture alignment" wide>
              <JsonBlock value={workbench.alignment} />
            </Pane>
          </section>
        )}

        <Pane title="Last Result" description="Latest command or API response" wide>
          <JsonBlock value={workbench.out} />
        </Pane>
      </main>
    </div>
  );
}
