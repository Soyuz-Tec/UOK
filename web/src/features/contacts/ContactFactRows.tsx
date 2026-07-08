import { Building2, Globe, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import type { ContactFact, ContactFactKind } from "./contactPresentation";

const factIcons: Record<ContactFactKind, typeof Phone> = {
  address: MapPin,
  email: Mail,
  governance: ShieldCheck,
  organization: Building2,
  phone: Phone,
  website: Globe
};

export function ContactFactRows({
  facts,
  limit,
  compact = false,
  emptyText = "No contact facts recorded."
}: {
  facts: ContactFact[];
  limit?: number;
  compact?: boolean;
  emptyText?: string;
}) {
  const visibleFacts = typeof limit === "number" ? facts.slice(0, limit) : facts;

  if (!visibleFacts.length) {
    return <p className="contact-fact-empty">{emptyText}</p>;
  }

  return (
    <div className={compact ? "contact-fact-list compact" : "contact-fact-list"}>
      {visibleFacts.map((fact) => {
        const Icon = factIcons[fact.kind];
        return (
          <div className="contact-fact-row" key={`${fact.kind}-${fact.value}`}>
            <span className="contact-fact-icon" aria-hidden="true">
              <Icon size={compact ? 14 : 18} />
            </span>
            <span className="contact-fact-copy">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}
