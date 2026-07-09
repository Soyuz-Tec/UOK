import { describe, expect, it } from "vitest";

import { planningGridCellEditPayload, planningGridCellEditValidation } from "./planningGridInlineEdit";

describe("planning grid inline edit model", () => {
  it("maps editable columns to server task payloads", () => {
    expect(planningGridCellEditPayload("task", " Next task ")).toEqual({ title: "Next task" });
    expect(planningGridCellEditPayload("start", "2026-08-04")).toEqual({ start: "2026-08-04" });
    expect(planningGridCellEditPayload("end", "2026-08-08")).toEqual({ end: "2026-08-08" });
    expect(planningGridCellEditPayload("progress", "75")).toEqual({ progress: 75 });
    expect(planningGridCellEditPayload("status", "blocked")).toEqual({ status: "blocked" });
    expect(planningGridCellEditPayload("wbs", "1")).toEqual({});
  });

  it("validates editable grid values before server submission", () => {
    expect(planningGridCellEditValidation("task", "")).toBe("Enter a value.");
    expect(planningGridCellEditValidation("start", "08/04/2026")).toBe("Use YYYY-MM-DD.");
    expect(planningGridCellEditValidation("progress", "101")).toBe("Use 0 to 100.");
    expect(planningGridCellEditValidation("wbs", "1")).toBe("This column is read only.");
    expect(planningGridCellEditValidation("status", "planned")).toBe("");
  });
});
