import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authHeader,
  deferred,
  editableCapabilities,
  jsonResponse,
  renderWorkspace,
  thread,
  workspace,
} from "./communicationsWorkspaceTestSupport";
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});
describe("K Connect session boundaries", () => {
  it("supersedes an in-flight refresh when the session token changes", async () => {
    const oldRowsRequest = deferred<Response>();
    const oldThread = thread("thread-old", "Prior tenant room");
    const newThread = thread("thread-new", "Current tenant room");
    const fetchMock = vi.fn((path: RequestInfo | URL, options?: RequestInit) => {
      const authorization = authHeader(options);
      if (authorization === "Bearer tenant-a" && String(path).includes("/capabilities")) {
        return Promise.resolve(jsonResponse(editableCapabilities));
      }
      if (authorization === "Bearer tenant-a") return oldRowsRequest.promise;
      if (authorization === "Bearer tenant-b" && String(path).includes("/capabilities")) {
        return Promise.resolve(jsonResponse(editableCapabilities));
      }
      if (authorization === "Bearer tenant-b") return Promise.resolve(jsonResponse([newThread]));
      return Promise.reject(new Error(`Unexpected request: ${authorization} ${String(path)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderWorkspace("tenant-a");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    rerender(workspace("tenant-b"));
    await screen.findByText("Current tenant room", { selector: "h2" });

    oldRowsRequest.resolve(jsonResponse([oldThread]));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 authorized thread(s) loaded."));
    expect(screen.getByText("Current tenant room", { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByText("Prior tenant room")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not commit an old session create after the token changes", async () => {
    const createRequest = deferred<Response>();
    const currentThread = thread("thread-current", "Current tenant room");
    const oldCreated = thread("thread-old-created", "Prior tenant created room");
    const fetchMock = vi.fn((path: RequestInfo | URL, options?: RequestInit) => {
      const authorization = authHeader(options);
      if (authorization === "Bearer tenant-a" && String(path) === "/api/commands") {
        return createRequest.promise;
      }
      if (String(path).includes("/capabilities")) {
        return Promise.resolve(jsonResponse(editableCapabilities));
      }
      if (authorization === "Bearer tenant-a") return Promise.resolve(jsonResponse([]));
      if (authorization === "Bearer tenant-b") return Promise.resolve(jsonResponse([currentThread]));
      return Promise.reject(new Error(`Unexpected request: ${authorization} ${String(path)}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    const { rerender } = renderWorkspace("tenant-a");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: oldCreated.title } });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    rerender(workspace("tenant-b"));
    await screen.findByText("Current tenant room", { selector: "h2" });
    createRequest.resolve(jsonResponse({ result: oldCreated }));
    await waitFor(() => expect(screen.queryByText("Prior tenant created room")).not.toBeInTheDocument());
    expect(screen.getByText("Current tenant room", { selector: "h2" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects an old create after the session cycles back to the same token", async () => {
    const createRequest = deferred<Response>();
    const firstTenantAThread = thread("thread-a-first", "First tenant A room");
    const currentTenantAThread = thread("thread-a-current", "Current tenant A room");
    const tenantBThread = thread("thread-b", "Tenant B room");
    const oldCreated = thread("thread-a-old-created", "Old tenant A created room");
    let tenantAListRequest = 0;
    const fetchMock = vi.fn((path: RequestInfo | URL, options?: RequestInit) => {
      const authorization = authHeader(options);
      if (authorization === "Bearer tenant-a" && String(path) === "/api/commands") {
        return createRequest.promise;
      }
      if (String(path).includes("/capabilities")) {
        return Promise.resolve(jsonResponse(editableCapabilities));
      }
      if (authorization === "Bearer tenant-a") {
        tenantAListRequest += 1;
        return Promise.resolve(jsonResponse([
          tenantAListRequest === 1 ? firstTenantAThread : currentTenantAThread,
        ]));
      }
      if (authorization === "Bearer tenant-b") {
        return Promise.resolve(jsonResponse([tenantBThread]));
      }
      return Promise.reject(new Error(`Unexpected request: ${authorization} ${String(path)}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    const { rerender } = renderWorkspace("tenant-a");
    await screen.findByText(firstTenantAThread.title, { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), {
      target: { value: oldCreated.title },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    rerender(workspace("tenant-b"));
    await screen.findByText(tenantBThread.title, { selector: "h2" });
    rerender(workspace("tenant-a"));
    await screen.findByText(currentTenantAThread.title, { selector: "h2" });

    createRequest.resolve(jsonResponse({ result: oldCreated }));
    await waitFor(() => expect(screen.queryByText(oldCreated.title)).not.toBeInTheDocument());
    expect(screen.getByText(currentTenantAThread.title, { selector: "h2" }))
      .toBeInTheDocument();
  });

  it("unlocks and supersedes a pending create across module disable and re-enable", async () => {
    const createRequest = deferred<Response>();
    const initialThread = thread("thread-initial", "Initial room");
    const authoritativeThread = thread("thread-authoritative", "Authoritative room");
    const oldCreated = thread("thread-old-created", "Created while disabling");
    const authoritativeRequest = deferred<Response>();
    let listRequest = 0;
    const fetchMock = vi.fn((path: RequestInfo | URL) => {
      if (String(path) === "/api/commands") return createRequest.promise;
      if (String(path).includes("/capabilities")) {
        return Promise.resolve(jsonResponse(editableCapabilities));
      }
      listRequest += 1;
      return listRequest === 1
        ? Promise.resolve(jsonResponse([initialThread]))
        : authoritativeRequest.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    const { rerender } = renderWorkspace("token");
    await screen.findByText(initialThread.title, { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    fireEvent.change(screen.getByLabelText("Thread title"), {
      target: { value: oldCreated.title },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create thread" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    rerender(workspace("token", "disabled"));
    rerender(workspace("token", "installed"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(screen.queryByText(initialThread.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New thread" })).not.toBeInTheDocument();

    authoritativeRequest.resolve(jsonResponse([authoritativeThread]));
    await screen.findByText(authoritativeThread.title, { selector: "h2" });

    createRequest.resolve(jsonResponse({ result: oldCreated }));
    await waitFor(() => expect(screen.queryByText(oldCreated.title)).not.toBeInTheDocument());
    expect(screen.getByText(authoritativeThread.title, { selector: "h2" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New thread" })).toBeEnabled();
  });

  it("resets a selection that disappears from an authoritative refresh", async () => {
    const former = thread("thread-former", "Former room");
    const replacement = thread("thread-replacement", "Replacement room");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(editableCapabilities))
      .mockResolvedValueOnce(jsonResponse([thread("thread-first", "First room"), former]))
      .mockResolvedValueOnce(jsonResponse(editableCapabilities))
      .mockResolvedValueOnce(jsonResponse([replacement]))
      .mockResolvedValueOnce(jsonResponse(editableCapabilities))
      .mockResolvedValueOnce(jsonResponse([former, replacement])));

    renderWorkspace("token");
    await screen.findByText("First room", { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: /Former room/ }));
    refreshFromMoreActions();
    await screen.findByText("Replacement room", { selector: "h2" });
    refreshFromMoreActions();
    await waitFor(() => expect(screen.getByText("Replacement room", { selector: "h2" })).toBeInTheDocument());
  });
});

function refreshFromMoreActions() {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "More actions" })).getByRole("button", { name: "Refresh" }));
}
