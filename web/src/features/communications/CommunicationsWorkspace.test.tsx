import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommunicationsWorkspace } from "./CommunicationsWorkspace";
import type { CommunicationThread } from "./types";

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

    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Created control room" } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Created Created control room."));
    const commandBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(commandBody).toMatchObject({
      command_type: "CreateCommunicationThread",
      payload: { title: "Created control room", context_type: "general" },
    });
  });
});

const moduleRow = {
  name: "communications.core", status: "installed", version: "3.1.0-alpha.3", kind: "capability_module",
  installable: true, uninstallable: true, updatable: true, maintainable: true, required: false, dependencies: [], dependents: [],
};

function thread(id: string, title: string): CommunicationThread {
  return {
    id, title, status: "open", context_type: "planning.task", context_id: "task-1",
    created_by_user_id: "user-1", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
