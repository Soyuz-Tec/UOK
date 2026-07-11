import { GitMerge, Link2, NotebookText, Tags, UsersRound } from "lucide-react";

import { formatLabel } from "@uok/shared/format";
import type { ContactRecord } from "@uok/shared/types";

type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  icon: typeof NotebookText;
};

export function ContactActivityTimeline({ contact }: { contact: ContactRecord }) {
  const items = contactTimelineItems(contact);

  return (
    <section className="contact-activity-timeline" aria-label="Contact activity timeline">
      <div>
        <p className="eyebrow">Timeline</p>
        <h3>Why this contact exists</h3>
      </div>
      <div className="contact-timeline-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article className="contact-timeline-item" key={item.id}>
              <span className="contact-timeline-icon"><Icon size={18} aria-hidden="true" /></span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {item.meta ? <small>{item.meta}</small> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function contactTimelineItems(contact: ContactRecord): TimelineItem[] {
  return [
    sourceItem(contact),
    ...noteItems(contact),
    ...relationshipItems(contact),
    ...groupItems(contact),
    ...duplicateItems(contact),
    ...mergeItems(contact)
  ];
}

function sourceItem(contact: ContactRecord): TimelineItem {
  const source = formatLabel(contact.source || "contacts");
  const imported = ["csv_import", "gmail", "email", "vcard"].includes(contact.source);
  return {
    id: "source",
    title: imported ? "Imported for review" : "Created in Contacts",
    detail: imported ? `Source: ${source}. Confirm important details before normal use.` : `Source: ${source}.`,
    meta: contact.created_at ? `Created ${contact.created_at}` : undefined,
    icon: NotebookText
  };
}

function noteItems(contact: ContactRecord): TimelineItem[] {
  return (contact.notes || []).map((note) => ({
    id: `note-${note.id}`,
    title: "Purpose note",
    detail: note.body,
    meta: note.created_at,
    icon: NotebookText
  }));
}

function relationshipItems(contact: ContactRecord): TimelineItem[] {
  return (contact.relationships || []).map((relationship) => ({
    id: `relationship-${relationship.id}`,
    title: formatLabel(relationship.relationship_type),
    detail: relationship.related_party_name
      ? `${relationship.related_party_name} · ${formatLabel(relationship.related_party_type || "contact")}`
      : "Linked contact",
    meta: relationship.related_party_email || relationship.related_party_phone,
    icon: Link2
  }));
}

function groupItems(contact: ContactRecord): TimelineItem[] {
  return (contact.groups || []).map((group) => ({
    id: `group-${group.member_id}`,
    title: "Group membership",
    detail: group.name,
    meta: group.created_at,
    icon: UsersRound
  }));
}

function duplicateItems(contact: ContactRecord): TimelineItem[] {
  return (contact.duplicate_candidates || []).map((duplicate) => ({
    id: `duplicate-${duplicate.id}`,
    title: "Duplicate candidate",
    detail: duplicate.display_name,
    meta: duplicate.reason ? `Reason: ${duplicate.reason}` : undefined,
    icon: GitMerge
  }));
}

function mergeItems(contact: ContactRecord): TimelineItem[] {
  const history = contact.attrs.merge_history || [];
  return history.map((merge) => ({
    id: `merge-${merge.merge_id}`,
    title: merge.rolled_back_at ? "Duplicate merge rolled back" : "Duplicate merged",
    detail: merge.duplicate_display_name ? `Merged ${merge.duplicate_display_name}` : "Merged duplicate record",
    meta: merge.rolled_back_at || merge.merged_at,
    icon: merge.rolled_back_at ? Tags : GitMerge
  }));
}
