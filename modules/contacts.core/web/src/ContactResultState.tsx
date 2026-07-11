import { formatLabel } from "@uok/shared/format";
import { EmptyState } from "@uok/shared/data-display";
import type { ContactRecord } from "@uok/shared/types";
import { contactReviewTone, contactStatusTone } from "./contactPresentation";

export function ContactStateText({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "info" }) {
  return <span className={`contact-state-text ${tone}`}>{label}</span>;
}

export function ContactStateStack({ contact }: { contact: ContactRecord }) {
  const status = formatLabel(contact.status);
  const review = formatLabel(contact.review_state);

  return (
    <span className="contact-state-stack" aria-label={`Status ${status}. Review ${review}.`}>
      <ContactStateText label={status} tone={contactStatusTone(contact.status)} />
      <ContactStateText label={review} tone={contactReviewTone(contact.review_state)} />
    </span>
  );
}

export function ContactResultsEmptyState() {
  return <EmptyState className="contact-results-empty" title="No matching contacts" text="Adjust search or filters to show contact records." />;
}
