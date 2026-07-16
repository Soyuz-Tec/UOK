import { FileInput, GitMerge, Info, TriangleAlert } from "lucide-react";

import type { ContactRecord } from "./contracts";

function reviewCopy(contact: ContactRecord) {
  if (contact.review_state === "possible_duplicate") {
    return {
      tone: "warning",
      icon: GitMerge,
      title: "Possible duplicate",
      body: "Compare this record before using it in a transaction."
    };
  }
  if (contact.review_state === "incomplete") {
    return {
      tone: "warning",
      icon: TriangleAlert,
      title: "Needs a little more detail",
      body: "Add a name, organization, contact method, or note so this record is useful later."
    };
  }
  if (contact.review_state === "needs_review") {
    return {
      tone: "info",
      icon: FileInput,
      title: "Imported for review",
      body: "Confirm the important details before marking this contact as ready for normal work."
    };
  }
  if (contact.source === "csv_import") {
    return {
      tone: "info",
      icon: FileInput,
      title: "Imported contact",
      body: "This contact came from an import. Review any missing or uncertain fields before relying on it."
    };
  }
  return null;
}

export function ContactReviewGuidance({ contact }: { contact: ContactRecord }) {
  const copy = reviewCopy(contact);
  if (!copy) return null;

  const Icon = copy.icon || Info;
  const duplicates = contact.duplicate_candidates || [];

  return (
    <section className={`contact-guidance contact-guidance-${copy.tone}`} aria-label="Contact guidance">
      <div className="contact-guidance-main">
        <span className="contact-guidance-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <strong>{copy.title}</strong>
          <p>{copy.body}</p>
        </div>
      </div>
      {duplicates.length ? (
        <div className="contact-guidance-duplicates">
          <span>Check against:</span>
          {duplicates.map((item) => <strong key={item.id}>{item.display_name}</strong>)}
        </div>
      ) : null}
    </section>
  );
}
