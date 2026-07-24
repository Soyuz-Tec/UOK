import type { PartyReference } from "./types";

export function partyReferenceLabel(reference: PartyReference, fallbackId: string | null) {
  if (reference.status === "denied") return "Restricted Party";
  return reference.display_label || fallbackId || reference.status_summary;
}
