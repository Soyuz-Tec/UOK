import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadCommunicationThread,
  loadCommunicationThreads,
} from "../../web/src/communicationsApi";

afterEach(() => vi.unstubAllGlobals());

describe("communications API response contracts", () => {
  it("rejects malformed records inside an otherwise valid thread-list array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([null])));

    await expect(loadCommunicationThreads("token", "all")).rejects.toMatchObject({
      status: 502,
      code: "communication_invalid_response",
    });
  });

  it("rejects a partial thread detail instead of casting it into the workspace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id: "thread-partial" })));

    await expect(loadCommunicationThread("token", "thread-partial", true)).rejects.toMatchObject({
      status: 502,
      code: "communication_invalid_response",
    });
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
