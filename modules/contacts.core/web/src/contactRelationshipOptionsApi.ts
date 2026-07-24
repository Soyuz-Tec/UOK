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
  signal?: AbortSignal
): Promise<ContactRelationshipOption[]> {
  const params = new URLSearchParams({
    query: query.trim(),
    exclude_party_id: excludePartyId,
    limit: "20"
  });
  const response = await fetch(`/api/contacts/relationship-options?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  const body = await response.json().catch(() => []);
  if (!response.ok) throw new Error(relationshipOptionsApiError(body));
  if (!Array.isArray(body)) throw new Error("Contact lookup response is invalid.");
  return body as ContactRelationshipOption[];
}

function relationshipOptionsApiError(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "error" in detail && typeof (detail as { error?: unknown }).error === "string") {
      return (detail as { error: string }).error;
    }
  }
  return "Unable to search contacts.";
}
