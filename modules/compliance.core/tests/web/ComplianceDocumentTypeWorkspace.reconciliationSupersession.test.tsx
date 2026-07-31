import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createComplianceMutationFetchController,
  freshJsonResponse,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  commandResponse,
  deactivatedDocumentType,
  oneCommand,
  ready,
  renderSurface,
  settle,
  startDeactivate,
} from "./ComplianceDocumentTypeWorkspace.mutationUiTestUtils";
import {
  activeDocumentType,
  complianceHost,
  inactiveDocumentType,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance mutation reconciliation supersession", () => {
  it("keeps the mutation locked until one current-intent successor replaces a stale reconciliation", async () => {
    const server = createComplianceMutationFetchController({
      rows: [activeDocumentType, inactiveDocumentType],
      history: { [activeDocumentType.id]: nameHistory },
    });
    const command = server.deferNext("command");
    const host = complianceHost();
    vi.stubGlobal("fetch", server.fetch);

    renderSurface(host);
    await ready();

    startDeactivate();
    await oneCommand(server);
    const staleReconciliation = server.deferNext("list");
    server.upsert(deactivatedDocumentType());
    await settle(command, commandResponse(deactivatedDocumentType()));
    await waitFor(() => expect(server.requestsOf("list")).toHaveLength(2));

    fireEvent.click(screen.getByRole("row", {
      name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
    }));
    fireEvent.change(screen.getByRole("textbox", {
      name: "Search compliance document types",
    }), { target: { value: "phytosanitary" } });
    await screen.findByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    });

    const successorReconciliation = server.deferNext("list");
    await act(async () => {
      staleReconciliation.resolve(freshJsonResponse([{
        ...activeDocumentType,
        canonical_name: "Stale reconciliation result",
      }]));
      await staleReconciliation.promise;
    });
    await waitFor(() => expect(server.requestsOf("list")).toHaveLength(3));

    expect(screen.getByRole("button", { name: "New document type" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit document type" })).toBeDisabled();
    expect(screen.getByRole("button", {
      name: "Activate document type",
    })).toBeDisabled();
    expect(screen.queryByText("Stale reconciliation result")).not.toBeInTheDocument();
    expect(screen.queryByText(`Deactivated ${activeDocumentType.canonical_name}.`))
      .not.toBeInTheDocument();
    expect(host.refreshHost).not.toHaveBeenCalled();

    await act(async () => {
      successorReconciliation.resolve(freshJsonResponse(server.snapshotRows()));
      await successorReconciliation.promise;
    });
    await waitFor(() => expect(screen.getByRole("button", {
      name: "New document type",
    })).toBeEnabled());

    expect(screen.getByRole("textbox", {
      name: "Search compliance document types",
    })).toHaveValue("phytosanitary");
    expect(screen.getByRole("heading", {
      name: inactiveDocumentType.canonical_name,
    })).toBeInTheDocument();
    expect(screen.queryByText("Stale reconciliation result")).not.toBeInTheDocument();
    expect(server.requestsOf("list")).toHaveLength(3);
    expect(server.requestsOf("detail").at(-1)?.documentTypeId)
      .toBe(inactiveDocumentType.id);
    expect(server.requestsOf("history").at(-1)?.documentTypeId)
      .toBe(inactiveDocumentType.id);
    expect(server.requestsOf("command")).toHaveLength(1);
    expect(host.refreshHost).not.toHaveBeenCalled();
  });
});
