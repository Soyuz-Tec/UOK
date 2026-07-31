import { vi } from "vitest";

import type {
  ContactGroupRecord,
  ContactRecord,
} from "../../web/src/contracts";
import { deferred, jsonResponse, type Deferred } from "./ContactReadTestUtils";

export type ContactMutationRequestKind =
  | "command"
  | "list"
  | "groups"
  | `detail:${string}`;

export type CapturedContactMutationRequest = {
  authorization?: string;
  body?: Record<string, unknown>;
  kind: ContactMutationRequestKind;
  method: string;
  path: string;
  sequence: number;
  signal?: AbortSignal;
};

type PlannedResponse = () => Response | Promise<Response>;

export function createContactMutationFetchController({
  rows: initialRows,
  groups: initialGroups = [],
}: {
  rows: ContactRecord[];
  groups?: ContactGroupRecord[];
}) {
  let rows = [...initialRows];
  let groups = [...initialGroups];
  let sequence = 0;
  const plans = new Map<ContactMutationRequestKind, PlannedResponse[]>();
  const requests: CapturedContactMutationRequest[] = [];
  const fetch = vi.fn(async (
    input: RequestInfo | URL,
    options: RequestInit = {},
  ) => {
    const path = String(input);
    const method = options.method || "GET";
    const kind = requestKind(path, method);
    const headers = options.headers as Record<string, string> | undefined;
    const captured: CapturedContactMutationRequest = {
      authorization: headers?.Authorization,
      body: options.body ? JSON.parse(String(options.body)) : undefined,
      kind,
      method,
      path,
      sequence: ++sequence,
      signal: options.signal ?? undefined,
    };
    requests.push(captured);
    const planned = plans.get(kind)?.shift();
    if (planned) return planned();
    if (kind === "command") {
      throw new Error(`Unplanned Contacts command: ${JSON.stringify(captured.body)}`);
    }
    if (kind === "groups") return jsonResponse(groups);
    if (kind === "list") {
      const visible = filterRows(rows, path);
      return jsonResponse(visible, 200, visible.length);
    }
    const id = kind.slice("detail:".length);
    const row = rows.find((candidate) => candidate.id === id);
    return row
      ? jsonResponse(row)
      : jsonResponse({ detail: "Contact not found." }, 404);
  });

  return {
    fetch,
    requests,
    deferNext(kind: ContactMutationRequestKind) {
      const pending = deferred<Response>();
      planNext(kind, () => pending.promise);
      return pending;
    },
    planNext,
    remove(id: string) {
      rows = rows.filter((row) => row.id !== id);
    },
    requestsOf(kind: ContactMutationRequestKind) {
      return requests.filter((request) => request.kind === kind);
    },
    setGroups(next: ContactGroupRecord[]) {
      groups = [...next];
    },
    upsert(row: ContactRecord) {
      rows = [...rows.filter((candidate) => candidate.id !== row.id), row];
    },
  };

  function planNext(kind: ContactMutationRequestKind, response: PlannedResponse) {
    plans.set(kind, [...(plans.get(kind) || []), response]);
  }
}

export function commandResponse(
  result: unknown,
  overrides: Record<string, unknown> = {},
) {
  return jsonResponse({
    command_id: "command-contact-1",
    idempotent: false,
    result,
    status: "succeeded",
    ...overrides,
  });
}

export function invalidJsonResponse(status = 200) {
  return new Response("not-json", {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function settle(
  request: Deferred<Response>,
  response: Response,
) {
  request.resolve(response);
  await request.promise;
}

function requestKind(
  path: string,
  method: string,
): ContactMutationRequestKind {
  if (path === "/api/commands" && method === "POST") return "command";
  if (path.startsWith("/api/contacts?")) return "list";
  if (path === "/api/contacts/groups") return "groups";
  return `detail:${decodeURIComponent(path.split("/").at(-1) || "")}`;
}

function filterRows(rows: ContactRecord[], path: string) {
  const params = new URLSearchParams(path.split("?")[1] || "");
  const query = (params.get("query") || "").toLocaleLowerCase();
  const status = params.get("status") || "active";
  return rows.filter((row) => (
    (!query || row.display_name.toLocaleLowerCase().includes(query))
    && (status === "all" || row.status === status)
  ));
}
