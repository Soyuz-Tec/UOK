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

describe("K Connect workspace", () => {
  it("opens the exact deep-linked thread and creates governed threads", async () => {
    window.history.replaceState({}, "", "/?view=communications&thread_id=thread-2");
    const created = thread("thread-3", "Created control room");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([thread("thread-1", "General room"), thread("thread-2", "Exact linked room")]))
      .mockResolvedValueOnce(jsonResponse({ result: created }))
      .mockResolvedValueOnce(jsonResponse([created, thread("thread-2", "Exact linked room")]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
    const exact = await screen.findByText("Exact linked room", { selector: "h2" });
    expect(exact.closest("article")?.getAttribute("data-thread-id")).toBe("thread-2");

    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    expect(screen.getByRole("dialog", { name: "Create communication thread" })).toBeInTheDocument();
    expect(screen.getByLabelText("Thread title")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Discarded title" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    expect(screen.getByLabelText("Thread title")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Created control room" } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Created Created control room."));
    const commandBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(commandBody).toMatchObject({
      command_type: "CreateCommunicationThread",
      payload: { title: "Created control room", context_type: "general" },
    });
    expect(screen.queryByRole("dialog", { name: "Create communication thread" })).not.toBeInTheDocument();
  });

  it("filters and sorts authorized threads from the shared command surface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      thread("thread-1", "Zulu room", { status: "open", context_type: "general", updated_at: "2026-08-01T00:00:00Z" }),
      thread("thread-2", "Alpha room", { status: "closed", context_type: "planning.task", updated_at: "2026-08-03T00:00:00Z" }),
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
    await screen.findByText("Zulu room", { selector: "h2" });
    expect(screen.getByLabelText("K Connect controls")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search options: All threads" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Search communication threads" }), { target: { value: "Zulu" } });
    expect(container.querySelector(".communications-thread-list")?.textContent).toContain("Zulu room");
    expect(container.querySelector(".communications-thread-list")?.textContent).not.toContain("Alpha room");

    fireEvent.change(screen.getByRole("textbox", { name: "Search communication threads" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "closed" } });
    expect(container.querySelector(".communications-thread-list")?.textContent).toContain("Alpha room");
    expect(container.querySelector(".communications-thread-list")?.textContent).not.toContain("Zulu room");
    expect(screen.getByText("Alpha room", { selector: "h2" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Context filter"), { target: { value: "general" } });
    expect(container.querySelector(".communications-thread-list")?.textContent).toContain("Zulu room");
    expect(container.querySelector(".communications-thread-list")?.textContent).not.toContain("Alpha room");

    fireEvent.change(screen.getByLabelText("Context filter"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Thread sort field"), { target: { value: "title" } });
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(Array.from(container.querySelectorAll(".communications-thread-list strong"), (node) => node.textContent)).toEqual(["Alpha room", "Zulu room"]);
  });

  it("commits a created thread even when the follow-up list refresh fails", async () => {
    const created = thread("thread-3", "Durable room", { context_type: "general" });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse([thread("thread-1", "General room")]))
      .mockResolvedValueOnce(jsonResponse({ result: created }))
      .mockRejectedValueOnce(new Error("refresh unavailable")));
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
    await screen.findByText("General room", { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Durable room" } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("The thread list could not be refreshed"));
    expect(screen.queryByRole("dialog", { name: "Create communication thread" })).not.toBeInTheDocument();
    expect(screen.getByText("Durable room", { selector: "h2" })).toBeInTheDocument();
  });

  it("prevents refresh and create operations from overlapping", async () => {
    const existing = thread("thread-1", "General room");
    const created = thread("thread-3", "Serialized room", { context_type: "general" });
    const refreshRequest = deferred<Response>();
    const createRequest = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([existing]))
      .mockReturnValueOnce(refreshRequest.promise)
      .mockReturnValueOnce(createRequest.promise)
      .mockResolvedValueOnce(jsonResponse([created, existing]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
    await screen.findByText("General room", { selector: "h2" });

    refreshFromMoreActions();
    await waitFor(() => expect(screen.getByRole("button", { name: "New thread" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    expect(screen.queryByRole("dialog", { name: "Create communication thread" })).not.toBeInTheDocument();

    refreshRequest.resolve(jsonResponse([existing]));
    await waitFor(() => expect(screen.getByRole("button", { name: "New thread" })).toBeEnabled());
    const idleActionsMenu = openMoreActions();
    expect(within(idleActionsMenu).getByRole("button", { name: "Refresh" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Serialized room" } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    expect(document.querySelector<HTMLButtonElement>('.workspace-actions-menu [data-command="refresh"]')).toBeDisabled();
    fireEvent.submit(screen.getByRole("dialog", { name: "Create communication thread" }).querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    createRequest.resolve(jsonResponse({ result: created }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Created Serialized room."));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });

  it("drops a created-thread fallback after an authoritative list refresh succeeds", async () => {
    const existing = thread("thread-1", "General room");
    const created = thread("thread-3", "Temporary fallback", { context_type: "general" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([existing]))
      .mockResolvedValueOnce(jsonResponse({ result: created }))
      .mockResolvedValueOnce(jsonResponse([created, existing]))
      .mockResolvedValueOnce(jsonResponse([existing]));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    const { container } = render(<CommunicationsWorkspace token="token" moduleRows={[moduleRow]} busyAction="" onInstall={vi.fn()} />);
    await screen.findByText("General room", { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Temporary fallback" } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(container.querySelector(".communications-thread-list")?.textContent).toContain("Temporary fallback");

    refreshFromMoreActions();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 authorized thread(s) loaded."));
    expect(container.querySelector(".communications-thread-list")?.textContent).not.toContain("Temporary fallback");
    expect(screen.getByText("General room", { selector: "h2" })).toBeInTheDocument();
  });
});

const moduleRow = {
  name: "communications.core", status: "installed", version: "3.1.0-alpha.3", kind: "capability_module",
  recorded_status: "installed", reconciliation_required: false,
  installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [],
  maturity: "runtime_proven" as const,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"], lifecycle_state_declared: true,
};

function thread(id: string, title: string, overrides: Partial<CommunicationThread> = {}): CommunicationThread {
  return {
    id, title, status: "open", context_type: "planning.task", context_id: "task-1",
    created_by_user_id: "user-1", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
    ...overrides,
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function openMoreActions() {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  return screen.getByRole("dialog", { name: "More actions" });
}

function refreshFromMoreActions() {
  fireEvent.click(within(openMoreActions()).getByRole("button", { name: "Refresh" }));
}
