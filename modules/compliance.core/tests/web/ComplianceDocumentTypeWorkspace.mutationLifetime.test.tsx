import { cleanup, fireEvent, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  freshJsonResponse,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  commandResponse,
  deactivatedDocumentType,
  mutationController,
  nonCommandCount,
  oneCommand,
  ready,
  renderSurface,
  settle,
  startDeactivate,
} from "./ComplianceDocumentTypeWorkspace.mutationUiTestUtils";
import { complianceHost } from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance mutation lifetime and single flight", () => {
  it("suppresses a command 401 after true unmount", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const unauthorized = vi.fn();
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const view = renderSurface(complianceHost({
      session: { onUnauthorized: unauthorized },
      refreshHost,
    }));
    await ready();

    startDeactivate();
    await oneCommand(controller);
    const readCount = nonCommandCount(controller);
    view.unmount();
    await settle(command, freshJsonResponse({ detail: "expired" }, 401));

    expect(unauthorized).not.toHaveBeenCalled();
    expect(refreshHost).not.toHaveBeenCalled();
    expect(nonCommandCount(controller)).toBe(readCount);
  });

  it("suppresses reconciliation and host refresh after successful unmount", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const view = renderSurface(complianceHost({ refreshHost }));
    await ready();

    startDeactivate();
    await oneCommand(controller);
    const readCount = nonCommandCount(controller);
    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    view.unmount();
    await settle(command, commandResponse(changed));

    expect(refreshHost).not.toHaveBeenCalled();
    expect(nonCommandCount(controller)).toBe(readCount);
  });

  it("sends one non-abortable command for a double click", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    vi.stubGlobal("fetch", controller.fetch);
    renderSurface(complianceHost());
    await ready();

    fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
      target: { value: "Tenant review" },
    });
    const button = screen.getByRole("button", { name: "Deactivate document type" });
    fireEvent.click(button);
    fireEvent.click(button);
    await oneCommand(controller);

    const captured = controller.requestsOf("command")[0];
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(captured.signal).toBeUndefined();
    expect(captured.command?.idempotency_key).toMatch(
      /^compliance-document-type-deactivate:/,
    );

    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    await settle(command, commandResponse(changed));
    await screen.findByRole("button", { name: "Activate document type" });
    expect(controller.requestsOf("command")).toHaveLength(1);
  });
});
