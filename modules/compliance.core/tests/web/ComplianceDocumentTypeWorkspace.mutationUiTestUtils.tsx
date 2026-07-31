import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect } from "vitest";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { complianceDocumentTypeModuleSurface } from "../../web/src/moduleSurface";
import type { ComplianceDocumentType } from "../../web/src/types";
import {
  createComplianceMutationFetchController,
  freshJsonResponse,
  type Deferred,
} from "./ComplianceDocumentTypeWorkspace.mutationTestUtils";
import {
  activeDocumentType,
  nameHistory,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

export function mutationController() {
  return createComplianceMutationFetchController({
    rows: [activeDocumentType],
    history: { [activeDocumentType.id]: nameHistory },
  });
}

export function renderSurface(host: ModuleSurfaceRenderContext) {
  return render(surface(host));
}

export function surface(host: ModuleSurfaceRenderContext) {
  return <>{complianceDocumentTypeModuleSurface.render(host)}</>;
}

export async function ready() {
  await screen.findByText("Ocean Bill → Bill of Lading");
}

export function startDeactivate() {
  fireEvent.change(screen.getByLabelText("Lifecycle reason"), {
    target: { value: "Tenant review" },
  });
  fireEvent.click(screen.getByRole("button", {
    name: "Deactivate document type",
  }));
}

export async function oneCommand(
  controller: ReturnType<typeof createComplianceMutationFetchController>,
) {
  await waitFor(() => expect(controller.requestsOf("command")).toHaveLength(1));
}

export function deactivatedDocumentType(): ComplianceDocumentType {
  return {
    ...activeDocumentType,
    status: "inactive",
    version: activeDocumentType.version + 1,
    updated_at: "2026-07-31T12:00:00Z",
  };
}

export function commandResponse(documentType: ComplianceDocumentType) {
  return freshJsonResponse({
    result: {
      ...documentType,
      correlation_id: "command-deactivate-1",
    },
  });
}

export async function settle(command: Deferred<Response>, response: Response) {
  await act(async () => {
    command.resolve(response);
    await command.promise;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function nonCommandCount(
  controller: ReturnType<typeof createComplianceMutationFetchController>,
) {
  return controller.requests.filter((request) => request.kind !== "command").length;
}

type HostOverrides = Omit<Partial<ModuleSurfaceRenderContext>, "session"> & {
  session?: Partial<ModuleSurfaceRenderContext["session"]>;
};

export function withHost(
  host: ModuleSurfaceRenderContext,
  overrides: HostOverrides,
): ModuleSurfaceRenderContext {
  const { session, ...hostOverrides } = overrides;
  return {
    ...host,
    ...hostOverrides,
    session: {
      ...host.session,
      ...session,
    },
  };
}
