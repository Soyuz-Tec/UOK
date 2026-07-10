import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningResourcePanel } from "./PlanningResourcePanel";
import type { PlanningSchedule } from "./types";

afterEach(cleanup);

describe("Planning typed resources", () => {
  it("submits controlled type, capacity, canonical target, and effective dates", async () => {
    const onCreateResource = vi.fn().mockResolvedValue(undefined);
    render(<PlanningResourcePanel
      schedule={{ resources: [] } as unknown as PlanningSchedule}
      selectedTask={null}
      busy=""
      onCreateResource={onCreateResource}
      onAssignResource={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Yard vehicle" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "vehicle" } });
    fireEvent.change(screen.getByLabelText("Capacity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Effective start"), { target: { value: "2026-08-05" } });
    fireEvent.change(screen.getByLabelText("Effective end"), { target: { value: "2026-08-25" } });
    fireEvent.change(screen.getByLabelText("Canonical target type"), { target: { value: "asset" } });
    fireEvent.change(screen.getByLabelText("Canonical target ID"), { target: { value: "asset-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Add resource" }));

    await waitFor(() => expect(onCreateResource).toHaveBeenCalledWith({
      name: "Yard vehicle",
      role: "",
      resource_type: "vehicle",
      capacity_value: 2,
      capacity_unit: "units",
      effective_start: "2026-08-05",
      effective_end: "2026-08-25",
      canonical_target_kind: "asset",
      canonical_target_id: "asset-42",
    }));
  });
});
