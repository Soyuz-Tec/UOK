import { Building2, Globe, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import { RecordFactList } from "@uok/shared/data-display";
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

  return (
    <RecordFactList
      compact={compact}
      emptyText={emptyText}
      items={visibleFacts.map((fact) => ({
        id: `${fact.kind}-${fact.value}`,
        icon: factIcons[fact.kind],
        label: fact.label,
        value: fact.value
      }))}
    />
  );
}
