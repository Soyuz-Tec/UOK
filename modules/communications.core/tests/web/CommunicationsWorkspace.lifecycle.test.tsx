import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunicationsWorkspace } from "../../web/src/CommunicationsWorkspace";
import type { CommunicationThread } from "../../web/src/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("K Connect recoverable thread deletion", () => {
  it("deletes with retained-impact confirmation, restores the prior state, and sends current validators", async () => {
    const closed = thread("thread-closed", "Closed control room", { status: "closed" });
    const archived = thread("thread-closed", "Closed control room", {
      status: "archived", restore_status: "closed", revision: 2,
    });
    const restored = thread("thread-closed", "Closed control room", { status: "closed", revision: 3 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(editableCapabilities))
      .mockResolvedValueOnce(jsonResponse([closed]))
      .mockResolvedValueOnce(jsonResponse(archived, { ETag: archived.etag }))
      .mockResolvedValueOnce(jsonResponse(restored, { ETag: restored.etag }));
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();
    await screen.findByText("Closed control room", { selector: "h2" });
    const deleteButton = screen.getByRole("button", { name: "Delete thread" });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    const dialog = screen.getByRole("alertdialog", { name: "Confirm thread deletion" });
    expect(dialog).toHaveTextContent("Delete “Closed control room”?");
    expect(dialog).toHaveTextContent("linked Planning records are not deleted");
    expect(dialog).toHaveTextContent("Restore will return it to closed");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete thread" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Confirm thread deletion" })).getByRole("button", { name: "Delete thread" }));

    await screen.findByRole("button", { name: "Restore thread" });
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({ "If-Match": closed.etag });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/communications/threads/thread-closed");
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore thread" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Restore thread" }));
    await screen.findByRole("button", { name: "Delete thread" });
    expect((fetchMock.mock.calls[3][1] as RequestInit).headers).toMatchObject({ "If-Match": archived.etag });
    expect(fetchMock.mock.calls[3][0]).toBe("/api/communications/threads/thread-closed/restore");
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete thread" })).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Thread restored.");
  });

  it("fails closed for review-only actors and keeps Archived discoverable when empty", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ read: true, create: false, delete: false, restore: false }))
      .mockResolvedValueOnce(jsonResponse([thread("thread-read", "Review room")])));

    renderWorkspace();
    await screen.findByText("Review room", { selector: "h2" });
    expect(screen.queryByRole("button", { name: "New thread" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete thread" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Review only");

    fireEvent.click(screen.getByRole("button", { name: "Search options: All threads" }));
    expect(screen.getByRole("option", { name: "Archived threads" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "archived" } });
    expect(screen.getByText("No communication threads match the current search.")).toBeInTheDocument();
  });

  it("reloads stale state, closes the old confirmation, and requires a new explicit confirmation", async () => {
    const original = thread("thread-stale", "Concurrent room");
    const latest = thread("thread-stale", "Concurrent room renamed", { revision: 2 });
    const staleError = {
      error: {
        code: "stale_precondition",
        message: "The communication thread changed after it was loaded.",
        repair: "Review the reloaded thread, then explicitly open and confirm Delete or Restore again.",
        reload_url: "/api/communications/threads/thread-stale",
        current_etag: latest.etag,
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(editableCapabilities))
      .mockResolvedValueOnce(jsonResponse([original]))
      .mockResolvedValueOnce(jsonResponse(staleError, { ETag: latest.etag }, 412))
      .mockResolvedValueOnce(jsonResponse(latest, { ETag: latest.etag }));
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();
    await screen.findByText("Concurrent room", { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Confirm thread deletion" })).getByRole("button", { name: "Delete thread" }));

    await screen.findByText("Concurrent room renamed", { selector: "h2" });
    expect(screen.queryByRole("alertdialog", { name: "Confirm thread deletion" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("explicitly open and confirm Delete or Restore again");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/communications/threads/thread-stale?include_archived=true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete thread" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    expect(screen.getByRole("alertdialog", { name: "Confirm thread deletion" })).toHaveTextContent("Concurrent room renamed");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

const moduleRow = {
  name: "communications.core", status: "installed", version: "3.1.0-alpha.3", kind: "capability_module",
  recorded_status: "installed", reconciliation_required: false,
  installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [],
  maturity: "runtime_proven" as const,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"], lifecycle_state_declared: true,
};

const editableCapabilities = { read: true, create: true, delete: true, restore: true };

function renderWorkspace() {
  return render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
}

function thread(id: string, title: string, overrides: Partial<CommunicationThread> = {}): CommunicationThread {
  const revision = overrides.revision || 1;
  return {
    id, title, status: "open", restore_status: null, revision,
    etag: `"communication-thread:${id}:v${revision}"`,
    context_type: "planning.task", context_id: "task-1", created_by_user_id: "user-1",
    created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
    ...overrides,
  };
}

function jsonResponse(value: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
