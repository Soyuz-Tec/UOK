import { act, cleanup, screen, waitFor } from "@testing-library/react";
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
  surface,
  withHost,
} from "./ComplianceDocumentTypeWorkspace.mutationUiTestUtils";
import {
  complianceHost,
  complianceModuleRow,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance mutation authority integration", () => {
  it("fails dispatch closed across a role ABA before the command starts", async () => {
    const controller = mutationController();
    vi.stubGlobal("fetch", controller.fetch);
    const initialHost = complianceHost();
    const view = renderSurface(initialHost);
    await ready();

    startDeactivate();
    view.rerender(surface(withHost(initialHost, {
      currentUserRole: "viewer",
    })));
    view.rerender(surface(withHost(initialHost, {
      currentUserRole: initialHost.currentUserRole,
    })));
    await act(async () => Promise.resolve());

    expect(controller.requestsOf("command")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "New document type" })).toBeEnabled();
  });

  it("keeps a same-token generation ABA command 401 inert", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const firstUnauthorized = vi.fn();
    const replacementUnauthorized = vi.fn();
    const returnedUnauthorized = vi.fn();
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const initialHost = complianceHost({
      session: {
        token: "same-token",
        generation: 0,
        onUnauthorized: firstUnauthorized,
      },
      refreshHost,
    });
    const view = renderSurface(initialHost);
    await ready();

    startDeactivate();
    await oneCommand(controller);
    view.rerender(surface(withHost(initialHost, {
      session: { generation: 1, onUnauthorized: replacementUnauthorized },
    })));
    view.rerender(surface(withHost(initialHost, {
      session: { generation: 2, onUnauthorized: returnedUnauthorized },
    })));
    await waitFor(() => expect(controller.requestsOf("list").length).toBeGreaterThan(1));
    const readCount = nonCommandCount(controller);

    await settle(command, freshJsonResponse({ detail: "expired" }, 401));
    await waitFor(() => expect(screen.getByRole("button", {
      name: "New document type",
    })).toBeEnabled());

    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(nonCommandCount(controller)).toBe(readCount);
    expect(firstUnauthorized).not.toHaveBeenCalled();
    expect(replacementUnauthorized).not.toHaveBeenCalled();
    expect(returnedUnauthorized).not.toHaveBeenCalled();
    expect(refreshHost).not.toHaveBeenCalled();
  });

  it("retains one operation across ops-manager, viewer, and trader renders", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const initialHost = complianceHost({ refreshHost });
    const view = renderSurface(initialHost);
    await ready();

    startDeactivate();
    await oneCommand(controller);
    view.rerender(surface(withHost(initialHost, {
      currentUserRole: "viewer",
    })));
    expect(screen.queryByRole("button", { name: "New document type" }))
      .not.toBeInTheDocument();
    view.rerender(surface(withHost(initialHost, {
      currentUserRole: "trader",
    })));
    expect(screen.getByRole("button", { name: "New document type" })).toBeDisabled();

    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    await settle(command, commandResponse(changed));

    await screen.findByRole("button", { name: "Activate document type" });
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "New document type" })).toBeEnabled();
    expect(refreshHost).not.toHaveBeenCalled();
  });

  it("defers while disabled and hidden, then reconciles on reactivation", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const initialHost = complianceHost({ refreshHost });
    const view = renderSurface(initialHost);
    await ready();

    startDeactivate();
    await oneCommand(controller);
    view.rerender(surface(withHost(initialHost, {
      moduleRows: [{
        ...complianceModuleRow,
        status: "disabled",
        recorded_status: "disabled",
      }],
      surfaceActive: false,
    })));
    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    const readCount = nonCommandCount(controller);
    await settle(command, commandResponse(changed));
    expect(nonCommandCount(controller)).toBe(readCount);

    view.rerender(surface(withHost(initialHost, {
      moduleRows: [complianceModuleRow],
      surfaceActive: true,
    })));
    await screen.findByRole("button", { name: "Activate document type" });
    expect(nonCommandCount(controller)).toBeGreaterThan(readCount);
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(refreshHost).not.toHaveBeenCalled();
  });

  it("does not invalidate or restart a command for an appearance rerender", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const refreshHost = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const initialHost = complianceHost({ refreshHost });
    const view = renderSurface(initialHost);
    await ready();

    startDeactivate();
    await oneCommand(controller);
    const readCount = nonCommandCount(controller);
    view.rerender(surface(withHost(initialHost, { appearance: "dark" })));
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(nonCommandCount(controller)).toBe(readCount);

    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    await settle(command, commandResponse(changed));
    await screen.findByRole("button", { name: "Activate document type" });
    expect(refreshHost).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Deactivated ${changed.canonical_name}.`,
    );
  });
});
