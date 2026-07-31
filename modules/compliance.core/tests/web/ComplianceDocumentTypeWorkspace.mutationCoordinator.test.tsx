import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { createComplianceMutationFetchController, freshJsonResponse } from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  activeDocumentType,
  complianceHost,
  complianceModuleRow,
  inactiveDocumentType,
} from "./ComplianceDocumentTypeWorkspace.testUtils";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Compliance mutation coordinator", () => {
  it.each([
    ["lost manage capability", (host: ModuleSurfaceRenderContext) => ({
      ...host,
      currentUserRole: "viewer",
    })],
    ["non-operational module", (host: ModuleSurfaceRenderContext) => ({
      ...host,
      moduleRows: [{ ...complianceModuleRow, status: "disabled" }],
    })],
    ["inactive retained surface", (host: ModuleSurfaceRenderContext) => ({
      ...host,
      surfaceActive: false,
    })],
  ])("fails dispatch closed after %s", async (_label, replaceHost) => {
    const controller = createComplianceMutationFetchController({
      rows: [activeDocumentType],
    });
    vi.stubGlobal("fetch", controller.fetch);
    const host = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Authority changed before dispatch" },
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", {
        name: "Deactivate document type",
      }));
      rerender(<ComplianceDocumentTypeWorkspace host={replaceHost(host)} />);
    });

    await act(async () => Promise.resolve());
    expect(controller.requestsOf("command")).toHaveLength(0);
  });

  it("fails dispatch closed when the selected target changes before dispatch", async () => {
    const controller = createComplianceMutationFetchController({
      rows: [activeDocumentType, inactiveDocumentType],
    });
    vi.stubGlobal("fetch", controller.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Selection changed before dispatch" },
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", {
        name: "Deactivate document type",
      }));
      fireEvent.click(screen.getByRole("row", {
        name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
      }));
    });

    await act(async () => Promise.resolve());
    expect(controller.requestsOf("command")).toHaveLength(0);
  });

  it("keeps one true lock through stale completion and reconciliation", async () => {
    const command = controllerWithDeferredCommand();
    vi.stubGlobal("fetch", command.controller.fetch);
    const host = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Single flight mutation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate document type" }));
    await waitFor(() => expect(command.controller.requestsOf("command")).toHaveLength(1));
    expect(command.controller.requestsOf("command")[0].signal).toBeUndefined();

    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...host,
      session: { ...host.session, generation: 1 },
    }} />);
    await waitFor(() => expect(command.controller.requestsOf("list")).toHaveLength(2));
    const reconciliationList = command.controller.deferNext("list");
    await act(async () => {
      command.controller.upsert(deactivatedDocumentType);
      command.response.resolve(commandResponse(deactivatedDocumentType));
    });
    await waitFor(() => expect(command.controller.requestsOf("list")).toHaveLength(3));

    expect(screen.getByRole("button", { name: "New document type" })).toBeDisabled();
    expect(screen.getByLabelText("Lifecycle reason")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit document type" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "New document type" }));
    expect(command.controller.requestsOf("command")).toHaveLength(1);

    await act(async () => {
      reconciliationList.resolve(freshJsonResponse([deactivatedDocumentType]));
    });
    await screen.findByRole("button", { name: "Activate document type" });
    expect(screen.getByRole("button", { name: "New document type" })).toBeEnabled();
  });

  it("keeps failed reconciliation pending until explicit Refresh retries it", async () => {
    const command = controllerWithDeferredCommand();
    const refreshHost = vi.fn().mockRejectedValue(new Error("host refresh unavailable"));
    vi.stubGlobal("fetch", command.controller.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({ refreshHost })} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Retry authoritative state" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate document type" }));
    await waitFor(() => expect(command.controller.requestsOf("command")).toHaveLength(1));
    command.controller.planNext("list", () => (
      freshJsonResponse({ detail: "reconciliation unavailable" }, 503)
    ));
    await act(async () => {
      command.controller.upsert(deactivatedDocumentType);
      command.response.resolve(commandResponse(deactivatedDocumentType));
    });

    await screen.findByText(/authoritative reconciliation is pending/i);
    expect(command.controller.requestsOf("command")).toHaveLength(1);
    expect(refreshHost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await screen.findByRole("button", { name: "Activate document type" });
    await waitFor(() => expect(refreshHost).toHaveBeenCalledTimes(1));
    expect(command.controller.requestsOf("command")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Deactivated ${activeDocumentType.canonical_name}.`,
    );
  });

  it("handles a current command 401 once without publishing command error UI", async () => {
    const controller = createComplianceMutationFetchController({
      rows: [activeDocumentType],
    });
    const onUnauthorized = vi.fn();
    controller.planNext(
      "command",
      () => freshJsonResponse({ detail: "expired command session" }, 401),
    );
    vi.stubGlobal("fetch", controller.fetch);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      session: { onUnauthorized },
    })} />);
    await screen.findByRole("button", { name: "Deactivate document type" });

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Current unauthorized command" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate document type" }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(controller.requestsOf("command")[0].signal).toBeUndefined();
    expect(screen.queryByText("expired command session")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 compliance document type(s) loaded.",
    );
    expect(screen.getByRole("button", { name: "Deactivate document type" }))
      .not.toHaveAttribute("aria-busy", "true");
  });
});

const deactivatedDocumentType = {
  ...activeDocumentType,
  status: "inactive" as const,
  version: activeDocumentType.version + 1,
};

function controllerWithDeferredCommand() {
  const controller = createComplianceMutationFetchController({
    rows: [activeDocumentType],
  });
  const response = controller.deferNext("command");
  return { controller, response };
}

function commandResponse(documentType = deactivatedDocumentType) {
  return freshJsonResponse({
    result: { ...documentType, correlation_id: "corr-mutation-coordinator" },
  });
}
