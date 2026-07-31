import { afterEach, describe, expect, it, vi } from "vitest";

import { contactCommandApi } from "../../web/src/app/contactCommandApi";
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
