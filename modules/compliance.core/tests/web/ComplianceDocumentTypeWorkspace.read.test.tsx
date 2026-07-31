import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceDocumentTypeWorkspace } from "../../web/src/ComplianceDocumentTypeWorkspace";
import {
  activeDocumentType,
  archivedDocumentType,
  complianceFetchMock,
  complianceHost,
  complianceModuleRow,
  inactiveDocumentType,
  jsonResponse,
} from "./ComplianceDocumentTypeWorkspace.testUtils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Compliance Document Types read workspace", () => {
  it("offers installation and signed-out states through the neutral host", () => {
    const moduleAction = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      moduleRows: [{ ...complianceModuleRow, status: "available", recorded_status: null }],
      moduleAction,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Install Compliance Document Types" }));
    expect(moduleAction).toHaveBeenCalledWith("compliance.core", "install");

    rerender(<ComplianceDocumentTypeWorkspace host={complianceHost({
      moduleRows: [{ ...complianceModuleRow, status: "disabled" }],
      moduleAction,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "Enable Compliance Document Types" }));
    expect(moduleAction).toHaveBeenCalledWith("compliance.core", "enable");

    rerender(<ComplianceDocumentTypeWorkspace host={complianceHost({
      session: { token: "", generation: 1 },
    })} />);
    expect(screen.getByText("Sign in to open Compliance Document Types.")).toBeInTheDocument();
  });

  it("loads owner detail and history, then searches and filters status and category", async () => {
    const fetchMock = complianceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<ComplianceDocumentTypeWorkspace host={complianceHost()} />);

    await screen.findByText("Ocean Bill → Bill of Lading");
    const grid = within(screen.getByRole("grid", { name: "Compliance document types" }));
    expect(grid.getByText(inactiveDocumentType.code)).toBeInTheDocument();
    expect(grid.queryByText(archivedDocumentType.code)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input)
      === `/api/compliance/document-types/${activeDocumentType.id}`)).toBe(true);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search compliance document types" }),
      { target: { value: "phytosanitary" } },
    );
    expect(grid.getByText(inactiveDocumentType.code)).toBeInTheDocument();
    expect(grid.queryByText(activeDocumentType.code)).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search compliance document types" }),
      { target: { value: "" } },
    );
    fireEvent.click(screen.getByRole("button", {
      name: "Search options: Current document types",
    }));
    fireEvent.change(screen.getByLabelText("Category filter"), {
      target: { value: "Sanitary" },
    });
    expect(grid.getByText(inactiveDocumentType.code)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Category filter"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Status filter"), {
      target: { value: "archived" },
    });
    expect(grid.getByText(archivedDocumentType.code)).toBeInTheDocument();
  });

  it("supports keyboard row selection and neutral host refresh revisions", async () => {
    const fetchMock = complianceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const host = complianceHost();
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });

    fireEvent.keyDown(screen.getByRole("row", {
      name: `${inactiveDocumentType.code} ${inactiveDocumentType.canonical_name}`,
    }), { key: "Enter" });
    await screen.findByRole("heading", { name: inactiveDocumentType.canonical_name });

    const listCalls = () => fetchMock.mock.calls.filter(([input]) => String(input)
      .includes("include_archived=true")).length;
    const before = listCalls();
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });

  it.each(["finance_manager", "viewer"])("keeps %s role read-only", async (role) => {
    vi.stubGlobal("fetch", complianceFetchMock());
    render(<ComplianceDocumentTypeWorkspace host={complianceHost({
      currentUserRole: role,
    })} />);

    await screen.findByRole("heading", { name: activeDocumentType.canonical_name });
    expect(screen.queryByRole("button", { name: "New document type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit document type" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lifecycle reason")).not.toBeInTheDocument();
  });

  it("reports permission and unauthorized read failures", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "compliance.read required" }, 403));
    vi.stubGlobal("fetch", fetchMock);
    const host = complianceHost({ session: { onUnauthorized } });
    const { rerender } = render(<ComplianceDocumentTypeWorkspace host={host} />);
    await screen.findByText("compliance.read required");

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401));
    rerender(<ComplianceDocumentTypeWorkspace host={{
      ...host,
      moduleRefreshRevision: 1,
    }} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});
