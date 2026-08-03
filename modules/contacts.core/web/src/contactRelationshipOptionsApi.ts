import type { ContactReadRequest } from "./app/contactReadApi";
import { contactSecondaryReadJson } from "./app/contactSecondaryReadApi";

export type ContactRelationshipOption = {
  id: string;
  display_name: string;
  party_type: string;
  email?: string;
  phone?: string;
};

export async function getContactRelationshipOptions(
  token: string,
  query: string,
  excludePartyId: string,
  request: ContactReadRequest,
): Promise<ContactRelationshipOption[]> {
  const params = new URLSearchParams({
    query: query.trim(),
    exclude_party_id: excludePartyId,
    limit: "20"
  });
  const { body } = await contactSecondaryReadJson<unknown>(
    token,
    `/api/contacts/relationship-options?${params}`,
    request,
    "Unable to search contacts.",
  );
  if (!Array.isArray(body)) {
    throw new Error("Contact lookup response is invalid.");
  }
  return body as ContactRelationshipOption[];
}
