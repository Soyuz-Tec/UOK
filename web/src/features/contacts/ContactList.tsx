import { formatLabel } from "../../shared/format";
import type { ContactRecord } from "../../shared/types";
import { EmptyState, StatusPill } from "../../shared/ui";

export function ContactList({ contacts, selectedId, onSelect }: {
  contacts: ContactRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="contact-list" role="list" aria-label="Contact records">
      {contacts.length ? contacts.map((contact) => (
        <button key={contact.id} type="button" className={selectedId === contact.id ? "contact-list-row selected" : "contact-list-row"} onClick={() => onSelect(contact.id)}>
          <span className="contact-avatar">{contact.display_name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{contact.display_name}</strong>
            <small>{contact.email || contact.phone || formatLabel(contact.party_type)}</small>
          </span>
          <StatusPill label={formatLabel(contact.review_state)} tone={contact.review_state === "ready" ? "success" : "warning"} />
        </button>
      )) : <EmptyState text="No contacts loaded." />}
    </div>
  );
}
