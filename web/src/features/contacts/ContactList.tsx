import type { ContactGroupBy, ContactRecord } from "../../shared/types";
import { ColumnVisibilityMenu, useColumnVisibilityOptions } from "../../shared/tables";
import { ContactResultsEmptyState, ContactStateStack } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import {
  contactListDisplayFieldOptions,
  contactListDisplayHeader,
  contactListDisplayValue
} from "./contactListDisplayFields";
import { contactInitial } from "./contactPresentation";

export function ContactList({ contacts, selectedId, onSelect, groupBy }: {
  contacts: ContactRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  groupBy?: ContactGroupBy;
}) {
  const groups = groupContacts(contacts, groupBy || "none");
  const { resetColumnVisibility, setColumnVisible, visibility } = useColumnVisibilityOptions(
    "contacts.list.display_fields",
    contactListDisplayFieldOptions
  );
  const detailHeader = contactListDisplayHeader(visibility);

  return (
    <div className="contact-list" role="list" aria-label="Contact records">
      {contacts.length ? (
        <>
          <div className="contact-list-header">
            <span>Name</span>
            <span className="contact-list-display-header">
              <span>{detailHeader}</span>
              <ColumnVisibilityMenu
                groupLabel="Visible display fields"
                label="Display fields"
                options={contactListDisplayFieldOptions}
                resetLabel="Reset display fields"
                visibility={visibility}
                onReset={resetColumnVisibility}
                onToggle={setColumnVisible}
              />
            </span>
          </div>
          {groups.map((group) => (
            <section key={group.id} className="contact-group-section" aria-label={group.label}>
              {(groupBy && groupBy !== "none") ? <h3 className="contact-group-heading">{group.label}</h3> : null}
              {group.contacts.map((contact) => {
                const identity = contactListDisplayValue(contact, visibility);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={selectedId === contact.id ? "contact-list-row selected" : "contact-list-row"}
                    aria-pressed={selectedId === contact.id}
                    aria-current={selectedId === contact.id ? "true" : undefined}
                    onClick={() => onSelect(contact.id)}
                  >
                    <span className="contact-avatar">{contactInitial(contact.display_name)}</span>
                    <span className="contact-name-stack">
                      <strong>{contact.display_name}</strong>
                    </span>
                    <span className="contact-list-identity">{identity}</span>
                    <ContactStateStack contact={contact} />
                  </button>
                );
              })}
            </section>
          ))}
        </>
      ) : <ContactResultsEmptyState />}
    </div>
  );
}
