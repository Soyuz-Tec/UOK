import { formatLabel } from "@uok/shared/format";
import type { ContactGroupBy, ContactRecord } from "@uok/shared/types";
import { ContactFactRows } from "./ContactFactRows";
import { ContactResultsEmptyState } from "./ContactResultState";
import { groupContacts } from "./contactGrouping";
import { contactFacts, contactInitial } from "./contactPresentation";

export function ContactCardGrid({
  contacts,
  selectedContactId,
  onSelect,
  groupBy = "none"
}: {
  contacts: ContactRecord[];
  selectedContactId: string;
  onSelect: (id: string) => void;
  groupBy?: ContactGroupBy;
}) {
  if (!contacts.length) {
    return <ContactResultsEmptyState />;
  }

  const groups = groupContacts(contacts, groupBy);

  return (
    <div className="contact-card-groups">
      {groups.map((group) => (
        <section key={group.id} className="contact-group-section" aria-label={group.label}>
          {groupBy !== "none" ? <h3 className="contact-group-heading">{group.label}</h3> : null}
          <div className="contact-card-grid">
            {group.contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className={selectedContactId === contact.id ? "contact-card selected" : "contact-card"}
                aria-pressed={selectedContactId === contact.id}
                aria-current={selectedContactId === contact.id ? "true" : undefined}
                onClick={() => onSelect(contact.id)}
              >
                <span className="contact-card-avatar">{contactInitial(contact.display_name)}</span>
                <span className="contact-card-body">
                  <span className="contact-name-stack">
                    <strong>{contact.display_name}</strong>
                    <span>{formatLabel(contact.party_type)}</span>
                  </span>
                  <ContactFactRows facts={contactFacts(contact)} limit={3} compact emptyText="No contact details." />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
