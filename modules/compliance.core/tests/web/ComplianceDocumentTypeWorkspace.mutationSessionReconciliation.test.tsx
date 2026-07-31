import { cleanup, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { freshJsonResponse } from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
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
  activeDocumentType,
  complianceHost,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance mutation session reconciliation", () => {
  it("reconciles a token-A ambiguous commit exactly once with token B", async () => {
    const controller = mutationController();
    const command = controller.deferNext("command");
    const tokenAUnauthorized = vi.fn();
    const tokenARefresh = vi.fn().mockResolvedValue(undefined);
    const signedOutUnauthorized = vi.fn();
    const signedOutRefresh = vi.fn().mockResolvedValue(undefined);
    const tokenBUnauthorized = vi.fn();
    const tokenBRefresh = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", controller.fetch);
    const tokenAHost = complianceHost({
      session: {
        token: "token-a",
        generation: 7,
        onUnauthorized: tokenAUnauthorized,
      },
      refreshHost: tokenARefresh,
    });
    const view = renderSurface(tokenAHost);
    await ready();

    startDeactivate();
    await oneCommand(controller);
    const commandRequest = controller.requestsOf("command")[0];
    const readsBeforeSignOut = nonCommandCount(controller);
    const signedOutHost = withHost(tokenAHost, {
      session: {
        token: "",
        generation: 8,
        onUnauthorized: signedOutUnauthorized,
      },
      refreshHost: signedOutRefresh,
    });
    view.rerender(surface(signedOutHost));

    const changed = deactivatedDocumentType();
    controller.upsert(changed);
    await settle(command, freshJsonResponse({ detail: "response lost" }, 503));

    expect(commandRequest.authorization).toBe("Bearer token-a");
    expect(commandRequest.signal).toBeUndefined();
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(nonCommandCount(controller)).toBe(readsBeforeSignOut);
    expect(tokenAUnauthorized).not.toHaveBeenCalled();
    expect(signedOutUnauthorized).not.toHaveBeenCalled();
    expect(tokenARefresh).not.toHaveBeenCalled();
    expect(signedOutRefresh).not.toHaveBeenCalled();

    const tokenBReadStart = controller.requests.length;
    controller.planNext("list", () => freshJsonResponse([activeDocumentType]));
    view.rerender(surface(withHost(signedOutHost, {
      session: {
        token: "token-b",
        generation: 9,
        onUnauthorized: tokenBUnauthorized,
      },
      refreshHost: tokenBRefresh,
    })));

    await screen.findByRole("button", { name: "Activate document type" });
    await waitFor(() => expect(
      controller.requests.slice(tokenBReadStart).filter(
        (request) => request.kind === "history",
      ),
    ).toHaveLength(1));
    const tokenBReads = controller.requests.slice(tokenBReadStart);
    expect(tokenBReads.map((request) => request.kind)).toEqual([
      "list",
      "list",
      "detail",
      "history",
    ]);
    expect(tokenBReads.every(
      (request) => request.authorization === "Bearer token-b",
    )).toBe(true);
    expect(controller.requestsOf("command")).toHaveLength(1);
    expect(tokenBUnauthorized).not.toHaveBeenCalled();
    expect(tokenBRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 compliance document type(s) loaded.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("response lost");
  });
});
