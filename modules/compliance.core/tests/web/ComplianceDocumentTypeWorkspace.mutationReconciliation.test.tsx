import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ComplianceDocumentType, ComplianceDocumentTypeNameHistory } from "../../web/src/types";
import {
  createComplianceMutationFetchController,
  freshInvalidJsonResponse,
  freshJsonResponse,
  type Deferred,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  activeDocumentType,
  complianceHost,
  inactiveDocumentType,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Compliance mutation reconciliation", () => {
  it.each([
    ["HTTP 503", (request: Deferred<Response>) => request.resolve(
      freshJsonResponse({ detail: "late gateway failure" }, 503),
    )],
    ["transport rejection", (request: Deferred<Response>) => request.reject(
      new TypeError("Failed to fetch"),
    )],
    ["malformed HTTP 200", (request: Deferred<Response>) => request.resolve(
      freshInvalidJsonResponse(),
    )],
  ])("reconciles a committed command after %s without replay", async (_, settle) => {
    const committed = version(4, "Reconciled Bill of Lading");
    const history = renamedHistory(committed);
    const server = createComplianceMutationFetchController({
      rows: [activeDocumentType],
      history: { [activeDocumentType.id]: nameHistory },
    });
    const command = server.deferNext("command");
    stubUuid();
    vi.stubGlobal("fetch", server.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    submitEdit(committed.canonical_name);
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    server.upsert(committed);
    server.setHistory(committed.id, history);
    await act(async () => settle(command));
    await screen.findByRole("heading", { name: committed.canonical_name });
    await screen.findByText(`Bill of Lading → ${committed.canonical_name}`);
    expect(server.requestsOf("command")).toHaveLength(1);
    expect(server.requestsOf("list").at(-1)!.sequence)
      .toBeGreaterThan(server.requestsOf("command")[0].sequence);
    expect(server.requestsOf("detail").at(-1)!.documentTypeId).toBe(committed.id);
    expect(server.requestsOf("history").at(-1)!.documentTypeId).toBe(committed.id);
  });

  it("reconciles a conflict version before a later explicit retry", async () => {
    const current = version(4, "Server Version Four");
    const retried = version(5, "Explicit Retry");
    const server = createComplianceMutationFetchController({ rows: [activeDocumentType] });
    const conflict = server.deferNext("command");
    stubUuid();
    vi.stubGlobal("fetch", server.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    submitEdit("First Attempt");
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    server.upsert(current);
    await act(async () => conflict.resolve(
      freshJsonResponse({ detail: "expected_version conflict" }, 409),
    ));
    await screen.findByRole("heading", { name: current.canonical_name });
    const retry = server.deferNext("command");
    submitEdit(retried.canonical_name);
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(2));
    const commands = server.requestsOf("command").map((request) => request.command!);
    expect(commands.map((command) => command.payload.expected_version)).toEqual([3, 4]);
    expect(commands[1].idempotency_key).not.toBe(commands[0].idempotency_key);
    server.upsert(retried);
    await act(async () => retry.resolve(commandResult(retried, "retry")));
    await screen.findByRole("heading", { name: retried.canonical_name });
  });

  it("preserves current filter and selection intent across an A-B-A mutation", async () => {
    const committed = { ...activeDocumentType, status: "inactive" as const, version: 4 };
    const server = createComplianceMutationFetchController({
      rows: [activeDocumentType, inactiveDocumentType],
    });
    const command = server.deferNext("command");
    stubUuid();
    vi.stubGlobal("fetch", server.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("button", { name: "Deactivate document type" });
    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Tenant review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate document type" }));
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    selectRow(inactiveDocumentType);
    selectRow(activeDocumentType);
    fireEvent.change(screen.getByRole("textbox", {
      name: "Search compliance document types",
    }), { target: { value: "phytosanitary" } });
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });
    server.upsert(committed);
    await act(async () => command.resolve(commandResult(committed, "deactivate")));
    await waitFor(() => expect(screen.getByRole("textbox", {
      name: "Search compliance document types",
    })).toHaveValue("phytosanitary"));
    expect(screen.getByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search options:/ }));
    expect(screen.getByLabelText("Status filter")).toHaveValue("current");
  });

  it("does not regress external version five to a delayed version four", async () => {
    const delayed = version(4, "Delayed Version Four");
    const external = version(5, "External Version Five");
    const server = createComplianceMutationFetchController({ rows: [activeDocumentType] });
    const command = server.deferNext("command");
    stubUuid();
    vi.stubGlobal("fetch", server.fetch);
    const host = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    submitEdit(delayed.canonical_name);
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    server.upsert(external);
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await screen.findByRole("heading", { name: external.canonical_name });
    await act(async () => command.resolve(commandResult(delayed, "delayed")));
    await waitFor(() => expect(screen.getByRole("heading", {
      name: external.canonical_name,
    })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: delayed.canonical_name }))
      .not.toBeInTheDocument();
  });

  it("reloads rename history when the optional host refresh rejects", async () => {
    const renamed = version(4, "Governed Bill of Lading");
    const history = renamedHistory(renamed);
    const server = createComplianceMutationFetchController({ rows: [activeDocumentType] });
    const command = server.deferNext("command");
    const refreshHost = vi.fn().mockRejectedValue(new Error("host refresh failed"));
    stubUuid();
    vi.stubGlobal("fetch", server.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({ refreshHost })} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    submitEdit(renamed.canonical_name);
    await waitFor(() => expect(server.requestsOf("command")).toHaveLength(1));
    server.upsert(renamed);
    server.setHistory(renamed.id, history);
    await act(async () => command.resolve(commandResult(renamed, "rename")));
    await screen.findByText(`Bill of Lading → ${renamed.canonical_name}`);
    await waitFor(() => expect(refreshHost).toHaveBeenCalledTimes(1));
    expect(screen.getByText(`Updated ${renamed.canonical_name}.`)).toBeInTheDocument();
    expect(server.requestsOf("command")).toHaveLength(1);
  });
});

function submitEdit(canonicalName: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edit document type" }));
  fireEvent.change(screen.getByLabelText("Canonical name"), {
    target: { value: canonicalName },
  });
  fireEvent.change(screen.getByLabelText("Change reason"), {
    target: { value: "Tenant vocabulary review" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save document type" }));
}
function selectRow(row: ComplianceDocumentType) {
  fireEvent.click(screen.getByRole("row", {
    name: `${row.code} ${row.canonical_name}`,
  }));
}
function version(number: number, canonicalName: string): ComplianceDocumentType {
  return { ...activeDocumentType, canonical_name: canonicalName, version: number };
}
function renamedHistory(row: ComplianceDocumentType): ComplianceDocumentTypeNameHistory[] {
  return [{
    ...nameHistory[0],
    id: `history-${row.version}`,
    previous_name: activeDocumentType.canonical_name,
    new_name: row.canonical_name,
  }];
}
function commandResult(row: ComplianceDocumentType, correlationId: string) {
  return freshJsonResponse({
    result: { ...row, correlation_id: `corr-${correlationId}` },
  });
}
function stubUuid() {
  let sequence = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
}
