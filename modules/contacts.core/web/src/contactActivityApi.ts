export type ContactActivityRecord = {
  id: string;
  party_id: string;
  actor_user_id?: string | null;
  activity_type: string;
  object_type: string;
  object_id: string;
  summary: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
};

export type ContactActivityPage = {
  items: ContactActivityRecord[];
  totalCount: number;
};

export async function getContactActivity(
  token: string,
  partyId: string,
  limit: number,
  offset: number,
  signal?: AbortSignal
): Promise<ContactActivityPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(`/api/contacts/${encodeURIComponent(partyId)}/activity?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  const body = await response.json().catch(() => []);
  if (!response.ok) throw new Error(activityApiError(body));
  if (!Array.isArray(body)) throw new Error("Contacts activity response is invalid.");
  const headerCount = Number(response.headers.get("X-Total-Count"));
  return {
    items: body as ContactActivityRecord[],
    totalCount: Number.isFinite(headerCount) ? headerCount : body.length
  };
}

function activityApiError(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "error" in detail && typeof (detail as { error?: unknown }).error === "string") {
      return (detail as { error: string }).error;
    }
  }
  return "Unable to load contact activity.";
}
