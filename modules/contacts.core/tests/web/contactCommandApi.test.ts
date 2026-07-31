import { afterEach, describe, expect, it, vi } from "vitest";

import {
  contactCommandApi,
  contactCommandResultId,
  executeContactCommand,
  isContactCommandApiError,
} from "../../web/src/app/contactCommandApi";
import { jsonResponse } from "./ContactReadTestUtils";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Contacts command API compatibility", () => {
  it("preserves method, body, bearer authorization, and custom headers", async () => {
    const responseBody = {
      result: { id: "contact-a", display_name: "Contact Alpha" },
      status: "completed",
      idempotent: false,
    };
    const body = JSON.stringify({
      command_type: "UpdateContact",
      payload: { party_id: "contact-a", display_name: "Contact Alpha" },
      idempotency_key: "contact-update:1",
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(responseBody));
    vi.stubGlobal("fetch", fetchMock);

    await expect(contactCommandApi(
      "command-token",
      vi.fn(),
      "/api/commands",
      {
        method: "POST",
        body,
        headers: {
          "If-Match": "\"contact-a-v2\"",
          "X-Correlation-Id": "correlation-1",
        },
      },
    )).resolves.toEqual(responseBody);

    expect(fetchMock).toHaveBeenCalledWith("/api/commands", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer command-token",
        "If-Match": "\"contact-a-v2\"",
        "X-Correlation-Id": "correlation-1",
      },
    });
  });

  it("throws the unchanged server error shape without treating 409 as logout", async () => {
    const errorBody = {
      detail: {
        code: "contact_precondition_stale",
        message: "The contact changed.",
        repair: "Reload the current contact.",
      },
    };
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(errorBody, 409),
    ));

    await expect(contactCommandApi(
      "command-token",
      onUnauthorized,
      "/api/commands",
      { method: "POST", body: "{}" },
    )).rejects.toEqual(errorBody);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("calls the supplied unauthorized handler once and throws its response body", async () => {
    const errorBody = { detail: "session expired" };
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(errorBody, 401),
    ));

    await expect(contactCommandApi(
      "command-token",
      onUnauthorized,
      "/api/commands",
    )).rejects.toEqual(errorBody);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("Contacts guarded command transport", () => {
  it("uses one caller key and keeps the command signal-free", async () => {
    const responseBody = {
      command_id: "command-1",
      idempotent: false,
      result: { contact_id: "contact-a" },
      status: "succeeded",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(responseBody));
    vi.stubGlobal("fetch", fetchMock);

    await expect(executeContactCommand(
      "command-token",
      "CreateContact",
      { display_name: "Contact Alpha" },
      { idempotencyKey: "contact-create:uuid-1", onUnauthorized: vi.fn() },
    )).resolves.toEqual(responseBody);

    expect(fetchMock).toHaveBeenCalledWith("/api/commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer command-token",
      },
      body: JSON.stringify({
        command_type: "CreateContact",
        payload: { display_name: "Contact Alpha" },
        idempotency_key: "contact-create:uuid-1",
      }),
    });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
    expect(contactCommandResultId(responseBody.result)).toBe("contact-a");
  });

  it("requires a succeeded command envelope", async () => {
    const body = {
      idempotent: false,
      result: { id: "contact-a" },
      status: "completed",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body)));

    const error = await captureError(executeContactCommand(
      "command-token",
      "UpdateContact",
      { party_id: "contact-a" },
      { idempotencyKey: "contact-update:uuid-1", onUnauthorized: vi.fn() },
    ));

    expect(isContactCommandApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 200, body, ambiguous: true });
  });

  it("types current 401 without marking it ambiguous", async () => {
    const body = { detail: "Session expired." };
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, 401)));

    const error = await captureError(executeContactCommand(
      "command-token",
      "ArchiveContact",
      { party_id: "contact-a" },
      { idempotencyKey: "contact-archive:uuid-1", onUnauthorized },
    ));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, body, ambiguous: false });
  });

  it.each([
    ["HTTP 503", () => Promise.resolve(jsonResponse({ detail: "late" }, 503)), 503],
    ["network loss", () => Promise.reject(new TypeError("Failed to fetch")), 0],
  ])("preserves %s as an ambiguous outcome", async (_label, response, status) => {
    vi.stubGlobal("fetch", vi.fn(response));

    const error = await captureError(executeContactCommand(
      "command-token",
      "RestoreContact",
      { party_id: "contact-a" },
      { idempotencyKey: "contact-restore:uuid-1", onUnauthorized: vi.fn() },
    ));

    expect(isContactCommandApiError(error)).toBe(true);
    expect(error).toMatchObject({ status, ambiguous: true });
  });
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected Contacts command transport to reject.");
}
