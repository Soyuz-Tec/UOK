import type { ContactGroupBy, ContactRecord } from "../../shared/types";
import { ContactResultsEmptyState, ContactStateStack } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import { contactInitial, contactListIdentity } from "./contactPresentation";

export function ContactList({ contacts, selectedId, onSelect, groupBy }: {
  contacts: ContactRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  groupBy?: ContactGroupBy;
}) {
  const groups = groupContacts(contacts, groupBy || "none");

  return (
    <div className="contact-list" role="list" aria-label="Contact records">
      {contacts.length ? groups.map((group) => (
        <section key={group.id} className="contact-group-section" aria-label={group.label}>
          {(groupBy && groupBy !== "none") ? <h3 className="contact-group-heading">{group.label}</h3> : null}
          {group.contacts.map((contact) => {
            const identity = contactListIdentity(contact);
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
      )) : <ContactResultsEmptyState />}
    </div>
  );
}
