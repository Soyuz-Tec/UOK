import { afterEach, describe, expect, it, vi } from "vitest";

import { generateAndDownloadReport } from "./serverReports";

describe("server report artifacts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a report artifact and downloads it with authorization", async () => {
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") Object.assign(element, { click });
      return element;
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artifacts: [{ id: "a1", format: "csv", filename: "schedule.csv", media_type: "text/csv", byte_size: 12, status: "generated" }], artifact_count: 1 }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["csv"], { type: "text/csv" }) }));
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:uok"), revokeObjectURL: vi.fn() });

    const artifact = await generateAndDownloadReport("token", {
      source_module: "planning.core",
      template_key: "planning.schedule",
      title: "Schedule",
      formats: ["csv"],
      payload: { rows: [] },
    }, "csv");

    expect(artifact.filename).toBe("schedule.csv");
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/reports/generate", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/reports/artifacts/a1/download", expect.objectContaining({ headers: { Authorization: "Bearer token" } }));
    expect(click).toHaveBeenCalled();
  });
});
