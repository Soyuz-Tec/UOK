import { vi } from "vitest";

import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "../../web/src/types";
import {
  captureComplianceRequest,
  cloneHistory,
  cloneRows,
  complianceReadResponse,
  deferred,
  type CapturedComplianceRequest,
  type ComplianceFetchResponder,
  type ComplianceRequestKind,
} from "./ComplianceDocumentTypeWorkspace.mutationHttpTestUtils";

export {
  deferred,
  freshInvalidJsonResponse,
  freshJsonResponse,
} from "./ComplianceDocumentTypeWorkspace.mutationHttpTestUtils";
export type {
  CapturedComplianceRequest,
  ComplianceCommandEnvelope,
  ComplianceFetchResponder,
  ComplianceRequestKind,
  Deferred,
} from "./ComplianceDocumentTypeWorkspace.mutationHttpTestUtils";

export function createComplianceMutationFetchController(options: {
  rows?: ComplianceDocumentType[];
  history?: Record<string, ComplianceDocumentTypeNameHistory[]>;
} = {}) {
  let rows = cloneRows(options.rows || []);
  const history = new Map<string, ComplianceDocumentTypeNameHistory[]>(
    Object.entries(options.history || {}).map(([id, entries]) => [
      id,
      cloneHistory(entries),
    ]),
  );
  const requests: CapturedComplianceRequest[] = [];
  const responders = new Map<ComplianceRequestKind, ComplianceFetchResponder[]>();
  let sequence = 0;

  function planNext(kind: ComplianceRequestKind, responder: ComplianceFetchResponder) {
    const queue = responders.get(kind) || [];
    queue.push(responder);
    responders.set(kind, queue);
  }

  function deferNext(kind: ComplianceRequestKind) {
    const pending = deferred<Response>();
    planNext(kind, () => pending.promise);
    return pending;
  }

  function requestsOf(kind: ComplianceRequestKind) {
    return requests.filter((request) => request.kind === kind);
  }

  function replaceRows(nextRows: ComplianceDocumentType[]) {
    rows = cloneRows(nextRows);
  }

  function upsert(row: ComplianceDocumentType) {
    rows = [
      { ...row },
      ...rows.filter((candidate) => candidate.id !== row.id),
    ];
  }

  function setHistory(
    documentTypeId: string,
    entries: ComplianceDocumentTypeNameHistory[],
  ) {
    history.set(documentTypeId, cloneHistory(entries));
  }

  const fetch = vi.fn(async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const captured = captureComplianceRequest(++sequence, input, init);
    requests.push(captured);
    const responder = responders.get(captured.kind)?.shift();
    if (responder) return responder(captured);
    if (captured.kind === "command") {
      throw new Error(
        `Unplanned Compliance command request: ${captured.command?.command_type || "unknown"}.`,
      );
    }
    return complianceReadResponse(captured, rows, history);
  });

  return {
    fetch,
    requests,
    requestsOf,
    planNext,
    deferNext,
    replaceRows,
    upsert,
    setHistory,
    snapshotRows: () => cloneRows(rows),
    historyFor: (documentTypeId: string) => cloneHistory(
      history.get(documentTypeId) || [],
    ),
  };
}
