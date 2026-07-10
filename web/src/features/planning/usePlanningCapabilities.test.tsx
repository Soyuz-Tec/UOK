import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readOnlyPlanningCapabilities, usePlanningCapabilities } from "./usePlanningCapabilities";


afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});


describe("usePlanningCapabilities", () => {
  it("uses the server matrix as the only source of write authority", async () => {
    const server = {
      read: true,
      edit: true,
      baseline_create: false,
      level: false,
      link: false,
      gate_approve: false,
      admin: false,
      review_only: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(server), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const { result } = renderHook(() => usePlanningCapabilities("token", true));
    await waitFor(() => expect(result.current).toEqual(server));
  });

  it("fails closed while unavailable or when the capability read fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { result } = renderHook(() => usePlanningCapabilities("token", true));
    await waitFor(() => expect(result.current).toEqual(readOnlyPlanningCapabilities));
    expect(result.current.edit).toBe(false);
    expect(result.current.review_only).toBe(true);
  });
});
