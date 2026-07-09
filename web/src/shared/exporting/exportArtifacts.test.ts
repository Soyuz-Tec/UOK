import { describe, expect, it } from "vitest";

import { csvContent, exportFilename, htmlDocumentContent, jsonContent, textArtifact, xmlText } from "./exportArtifacts";

describe("shared export artifacts", () => {
  it("builds stable export filenames", () => {
    expect(exportFilename("Pilot Delivery", "timeline image", "svg")).toBe("pilot-delivery-timeline-image.svg");
    expect(exportFilename("###", "", "CSV")).toBe("export-export.csv");
  });

  it("quotes CSV cells consistently", () => {
    expect(csvContent([["Name", "Note"], ["A, B", "said \"yes\""]])).toBe("\"Name\",\"Note\"\n\"A, B\",\"said \"\"yes\"\"\"");
  });

  it("builds JSON and generic text artifacts", () => {
    expect(jsonContent({ ok: true })).toBe("{\n  \"ok\": true\n}");
    expect(textArtifact("export.txt", "body", "text/plain")).toEqual({ filename: "export.txt", content: "body", mimeType: "text/plain" });
  });

  it("escapes XML text and attribute content", () => {
    expect(xmlText("A&B <C> \"D\"")).toBe("A&amp;B &lt;C&gt; &quot;D&quot;");
  });

  it("builds escaped reusable HTML documents", () => {
    const html = htmlDocumentContent({
      title: "Pilot <Delivery>",
      subtitle: "Schedule & proof",
      generatedAt: "2026-08-01T00:00:00.000Z",
      sections: [{
        heading: "Tasks",
        definitionList: [["Owner", "Ops & Planning"]],
        tables: [{ headers: ["Task"], rows: [["Scope <design>"]] }],
      }],
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Pilot &lt;Delivery&gt;");
    expect(html).toContain("Schedule &amp; proof");
    expect(html).toContain("Scope &lt;design&gt;");
  });
});
