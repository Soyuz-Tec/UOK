import type { ContactGroupBy, ContactRecord } from "./contracts";
import type { ColumnVisibilityMap } from "@uok/shared/tables";
import { ContactResultsEmptyState, ContactStateStack } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import { contactListDisplayHeader, contactListDisplayValue } from "./contactListDisplayFields";
import { contactInitial } from "./contactPresentation";

export function ContactList({ contacts, selectedId, onSelect, groupBy, displayVisibility }: {
  contacts: ContactRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  groupBy?: ContactGroupBy;
  displayVisibility: ColumnVisibilityMap;
}) {
  const groups = groupContacts(contacts, groupBy || "none");
  const detailHeader = contactListDisplayHeader(displayVisibility);

  return (
    <div className="contact-list" role="list" aria-label="Contact records">
      {contacts.length ? (
        <>
          <div className="contact-list-header">
            <span>Name</span>
            <span className="contact-list-display-header">
              <span>{detailHeader}</span>
            </span>
          </div>
          {groups.map((group) => (
            <section key={group.id} className="contact-group-section" aria-label={group.label}>
              {(groupBy && groupBy !== "none") ? <h3 className="contact-group-heading">{group.label}</h3> : null}
              {group.contacts.map((contact) => {
                const identity = contactListDisplayValue(contact, displayVisibility);
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
