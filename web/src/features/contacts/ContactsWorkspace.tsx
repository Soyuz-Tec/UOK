import { Download, Power, Search, Upload, UserPlus } from "lucide-react";
import type { KeyboardEvent } from "react";

import { contactsViewOptions } from "../../shared/options";
import { formatLabel } from "../../shared/format";
import { CommandButton, EmptyState, JsonBlock, Pane, SegmentedControl, StatusPill } from "../../shared/ui";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { ContactList } from "./ContactList";
import type { ContactsWorkspaceProps } from "./types";

export function ContactsWorkspace(props: ContactsWorkspaceProps) {
  const selectFromKeyboard = (event: KeyboardEvent, contactId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onSelect(contactId);
    }
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
    <section className="contacts-workspace" aria-label="Contacts">
      <div className="contacts-controls">
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Search contacts" />
        </label>
        <CommandButton icon={UserPlus} onClick={props.onCreate}>Add new</CommandButton>
        <SegmentedControl value={props.contactsView} onChange={props.onViewChange} options={contactsViewOptions} label="Contacts view" />
        <label className="field compact">
          <span>Status</span>
          <select value={props.statusFilter} onChange={(event) => props.onStatusFilterChange(event.target.value)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="field compact">
          <span>Review</span>
          <select value={props.reviewFilter} onChange={(event) => props.onReviewFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="ready">Ready</option>
            <option value="needs_review">Needs review</option>
            <option value="possible_duplicate">Possible duplicate</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </label>
        <label className="field compact">
          <span>Type</span>
          <select value={props.typeFilter} onChange={(event) => props.onTypeFilterChange(event.target.value)}>
            <option value="all">All</option>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
          </select>
        </label>
      </div>

      <div className="review-strip" aria-label="Review Queue">
        <div>
          <p className="eyebrow">Review Queue</p>
          <strong>{props.reviewRows.length}</strong>
        </div>
        <div className="review-items">
          {props.reviewRows.length ? props.reviewRows.slice(0, 4).map((row) => (
            <button key={row.id} type="button" className="review-chip" onClick={() => props.onSelect(row.id)}>
              {row.display_name}
              <StatusPill label={formatLabel(row.review_state)} tone="warning" />
            </button>
          )) : <span className="muted">No queued records</span>}
        </div>
      </div>

      {props.contactsView === "split" && (
        <div className="contacts-split">
          <ContactList contacts={props.contacts} selectedId={props.selectedContactId} onSelect={props.onSelect} />
          <ContactDetailPanel {...props} />
        </div>
      )}

      {props.contactsView === "table" && (
        <div className="contacts-table-wrap">
          <table className="contacts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {props.contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={props.selectedContactId === contact.id ? "selected" : ""}
                  tabIndex={0}
                  aria-selected={props.selectedContactId === contact.id}
                  onClick={() => props.onSelect(contact.id)}
                  onKeyDown={(event) => selectFromKeyboard(event, contact.id)}
                >
                  <td>{contact.display_name}</td>
                  <td>{formatLabel(contact.party_type)}</td>
                  <td>{contact.email || "-"}</td>
                  <td>{contact.phone || "-"}</td>
                  <td>{formatLabel(contact.status)}</td>
                  <td>{formatLabel(contact.review_state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {props.contactsView === "cards" && (
        <div className="contact-card-grid">
          {props.contacts.map((contact) => (
            <button key={contact.id} type="button" className={props.selectedContactId === contact.id ? "contact-card selected" : "contact-card"} onClick={() => props.onSelect(contact.id)}>
              <span className="contact-avatar">{contact.display_name.slice(0, 1).toUpperCase()}</span>
              <strong>{contact.display_name}</strong>
              <span>{contact.email || contact.phone || formatLabel(contact.party_type)}</span>
              <StatusPill label={formatLabel(contact.review_state)} tone={contact.review_state === "ready" ? "success" : "warning"} />
            </button>
          ))}
        </div>
      )}

      {(props.contactsView === "table" || props.contactsView === "cards") && <ContactDetailPanel {...props} />}

      <details className="workflow-disclosure">
        <summary>
          <strong>CSV Import</strong>
          <Upload size={18} aria-hidden="true" />
        </summary>
        <div className="contacts-utility-grid">
          <Pane description="CSV import form">
            <label className="field">
              <span>Filename</span>
              <input value={props.importFilename} onChange={(event) => props.onImportFilenameChange(event.target.value)} />
            </label>
            <label className="field">
              <span>CSV</span>
              <textarea value={props.importText} onChange={(event) => props.onImportTextChange(event.target.value)} rows={5} />
            </label>
            <CommandButton icon={Upload} onClick={props.onImport} loading={props.busyAction === "ImportContactsCsv"}>Import</CommandButton>
          </Pane>
          <Pane title="Import Batches" description="Recent">
            <JsonBlock value={props.importBatches} />
          </Pane>
        </div>
      </details>
    </section>
  );
}
