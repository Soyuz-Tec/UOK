import type { ContactReadRequest } from "./app/contactReadApi";
import {
  contactSecondaryReadJson,
  contactSecondaryTotalCount,
} from "./app/contactSecondaryReadApi";

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
  request: ContactReadRequest,
): Promise<ContactActivityPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const { body, response } = await contactSecondaryReadJson<unknown>(
    token,
    `/api/contacts/${encodeURIComponent(partyId)}/activity?${params}`,
    request,
    "Unable to load contact activity.",
  );
  if (!Array.isArray(body)) {
    throw new Error("Contacts activity response is invalid.");
  }
  return {
    items: body as ContactActivityRecord[],
    totalCount: contactSecondaryTotalCount(
      response.headers.get("X-Total-Count"),
      body.length,
    ),
  };
}
