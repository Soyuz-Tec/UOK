import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeStatus,
} from "../../web/src/types";
import {
  activeDocumentType,
  complianceFetchMock,
  complianceHost,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance Document Type lifecycle", () => {
  it("deactivates, activates, archives, and restores with reasons and versions", async () => {
    let current: ComplianceDocumentType = activeDocumentType;
    const commands: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    vi.stubGlobal("fetch", complianceFetchMock({
      rows: () => [current],
      command: (body) => {
        commands.push(body);
        const commandType = String(body.command_type);
        const nextStatus = statusForCommand(commandType);
        current = {
          ...current,
          status: nextStatus,
          version: current.version + 1,
          archived_at: nextStatus === "archived" ? "2026-07-17T12:00:00Z" : null,
        };
        return current;
      },
    }));
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);
    await findLifecycleButton("Deactivate document type");

    await runLifecycle("Deactivate document type", "Temporarily not used");
    await findLifecycleButton("Activate document type");
    await runLifecycle("Activate document type", "Approved again");
    await findLifecycleButton("Deactivate document type");
    await runLifecycle("Archive document type", "Superseded vocabulary");
    await findLifecycleButton("Restore document type");
    await runLifecycle("Restore document type", "Restored after review");
    await findLifecycleButton("Deactivate document type");

    expect(commands).toMatchObject([
      command("DeactivateComplianceDocumentType", 3, "Temporarily not used"),
      command("ActivateComplianceDocumentType", 4, "Approved again"),
      command("ArchiveComplianceDocumentType", 5, "Superseded vocabulary"),
      command("RestoreComplianceDocumentType", 6, "Restored after review"),
    ]);
  });
});

async function runLifecycle(buttonName: string, reason: string) {
  fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
    target: { value: reason },
  });
  const button = screen.getByRole("button", { name: buttonName });
  expect(button).toBeEnabled();
  await act(async () => {
    fireEvent.click(button);
  });
}

function findLifecycleButton(name: string) {
  return screen.findByRole("button", { name }, { timeout: 4_000 });
}

function command(commandType: string, version: number, reason: string) {
  return {
    command_type: commandType,
    payload: {
      compliance_document_type_id: activeDocumentType.id,
      expected_version: version,
      reason,
    },
  };
}

function statusForCommand(commandType: string): ComplianceDocumentTypeStatus {
  if (commandType.startsWith("Deactivate")) return "inactive";
  if (commandType.startsWith("Archive")) return "archived";
  return "active";
}
